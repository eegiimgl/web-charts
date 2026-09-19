"""Processor for the mse-brokers use-case.

Reads: ../data/raw/reports.json + ../data/raw/files/* (never modifies them).
Writes (chart-ready, committed):
  ../data/processed/brokers.json         — canonical broker list (code, name
                                           variants, first/last seen, months active)
  ../data/processed/monthly_totals.json  — long format: one row per broker × month
                                           {period, year, month, code, name,
                                            monthly_total, ytd_total}
  ../data/processed/market_totals.json   — market-wide "Нийт" row per month
  ../data/processed/_process_manifest.json — per-file status + validation + warnings

What is parsed: each monthly spreadsheet lists member companies with a
"Нийт арилжаа" (total trading, MNT) column. Layouts drift across 2013–2026
(xlsx vs real .xls, shifted columns), so columns are located by header text:
  - broker code column: header "Үсгэн код", name = next column, № = previous
  - monthly total column: first header cell exactly "Нийт" right of the name col
  - YTD total column: first header cell exactly "Нийт арилжаа" (absent pre-2015)
Data rows: numeric № → broker; "Нийт" → market total row; anything else → warning.

The 2013 annual report has no spreadsheet (PDF only) and is skipped.

Usage:
    pip install -r requirements.txt
    python process.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

SCRAPING_DIR = Path(__file__).resolve().parent
RAW_DIR = SCRAPING_DIR.parent / "data" / "raw"
PROCESSED_DIR = SCRAPING_DIR.parent / "data" / "processed"
INDEX_PATH = RAW_DIR / "reports.json"

TITLE_RE = re.compile(r"(\d{4})\s*оны\s*(?:(\d+)\s*(?:-р|дүгээр|дугаар)\s*сарын)?")

# Header texts vary by language (MN / ENG sheets) — all known variants:
CODE_HEADERS = {"Үсгэн код", "Symbol"}
NAME_HEADERS = {"Компанийн нэр", "Company name"}


def is_monthly_total_header(text: str) -> bool:
    return text == "Нийт" or text.startswith("Total value")


def is_ytd_total_header(text: str) -> bool:
    return text == "Нийт арилжаа" or text.startswith("Total trading value")


def is_ipo_header(text: str) -> bool:
    """Primary-market IPO column: header is literally 'IPO'/'IPOs' (all eras)."""
    return text.strip().lower() in ("ipo", "ipos")


# Rule of thumb for unlabeled primary-market columns (e.g. 2022's ГОЛОМТ БАНК):
# grouped under "анхдагч"/"primary" (initial offering) without any bond mention → IPO.
PRIMARY_KEYWORDS = ("анхдагч", "primary")
PRIMARY_BOND_EXCLUDE = ("бонд", "bond", "хбүц")


def is_stocks_header(text: str) -> bool:
    """Secondary-market stocks column: 'ХУВЬЦАА', 'ХУВЬЦАА /ХОС/', 'Хувьцаа'…,
    ENG 'Equity…' — but not 'Хувьцааны багцын арилжаа' (block trades)."""
    t = text.strip().lower()
    if t.startswith("equity"):
        return True
    return t.startswith("хувьцаа") and "багц" not in t


def is_bonds_header(text: str) -> bool:
    """Any bond leg: 'ЗГҮЦ'/'ЗГДҮЦ' (gov securities), 'Бонд…'/'ХБҮЦ',
    ENG '…bond…', 'Government securit…'. Several per sheet — all are summed."""
    t = text.strip().lower()
    return (
        "бонд" in t
        or t.startswith("зг")
        or "хбүц" in t
        or "bond" in t
        or "government securit" in t
    )


def parse_period(title: str) -> tuple[int | None, int | None]:
    m = TITLE_RE.search(title or "")
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2)) if m.group(2) else None


def clean_name(name: object) -> str:
    return str(name or "").replace('"', "").replace('"', "").replace('"', "").strip()


def is_int_like(v: object) -> bool:
    if isinstance(v, bool):
        return False
    if isinstance(v, (int, float)):
        return float(v).is_integer()
    if isinstance(v, str) and v.strip().isdigit():
        return True
    return False


def to_amount(v: object) -> float | None:
    """Cell → MNT amount. Blank means 0; error strings → None."""
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if s == "":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def read_sheet_rows(path: Path) -> list[list[object]]:
    """Read first sheet containing 'Үсгэн код'/'Symbol' as plain rows, whatever the format.

    Merged group labels (e.g. a primary-market header spanning several columns)
    are propagated to every covered cell so column classification sees them.
    """
    import io

    blob = path.read_bytes()
    if blob[:4] == b"PK\x03\x04":  # OOXML, regardless of .xls/.xlsx extension
        import openpyxl

        # BytesIO: openpyxl skips the .xls extension check for file-like objects.
        # (No read_only: merged-cell info is needed for group-label propagation.)
        wb = openpyxl.load_workbook(io.BytesIO(blob), data_only=True)
        for ws in wb.worksheets:
            rows = [list(r) for r in ws.iter_rows(values_only=True)]
            if any(str(c or "").strip() in CODE_HEADERS for r in rows[:20] for c in r):
                # Propagate merged group labels (header band only — row 30+ stays pristine
                # so vertical header merges can't leak into data rows).
                for rng in ws.merged_cells.ranges:
                    top = rows[rng.min_row - 1][rng.min_col - 1]
                    for rr in range(rng.min_row - 1, min(rng.max_row, 30)):
                        for cc in range(rng.min_col - 1, rng.max_col):
                            if rr < len(rows) and cc < len(rows[rr]):
                                rows[rr][cc] = top
                return rows
        raise ValueError("no sheet with broker-code header")
    else:  # legacy BIFF .xls
        import xlrd

        bk = xlrd.open_workbook(str(path))
        for sh in bk.sheets():
            head = [[sh.cell(r, c).value for c in range(sh.ncols)] for r in range(min(20, sh.nrows))]
            if any(str(c or "").strip() in CODE_HEADERS for r in head for c in r):
                rows = [[sh.cell(r, c).value for c in range(sh.ncols)] for r in range(sh.nrows)]
                for rlo, rhi, clo, chi in sh.merged_cells:
                    top = rows[rlo][clo]
                    for rr in range(rlo, min(rhi, 30)):
                        for cc in range(clo, chi):
                            rows[rr][cc] = top
                return rows
        raise ValueError("no sheet with broker-code header")


def locate_columns(rows: list[list[object]]) -> dict | None:
    """Find header row + code/name/№/monthly-total/YTD columns. None if not found."""
    header_idx = code_col = None
    for i, row in enumerate(rows[:30]):
        cells = [str(c or "").strip() for c in row]
        code_hits = [j for j, c in enumerate(cells) if c in CODE_HEADERS]
        if "№" in cells and code_hits:
            header_idx, code_col = i, code_hits[0]
            break
    if header_idx is None:
        return None
    name_col, no_col = code_col + 1, code_col - 1
    # sanity: name header should be a known name variant
    if str(rows[header_idx][name_col] or "").strip() not in NAME_HEADERS:
        pass  # layout drift — still proceed, columns are positional
    monthly_col = ytd_col = ipo_col = stocks_col = None
    bond_cols: list[int] = []
    for row in rows[header_idx : header_idx + 6]:
        for j in range(name_col + 1, len(row)):
            text = str(row[j] or "").strip()
            if is_monthly_total_header(text) and monthly_col is None:
                monthly_col = j
            elif is_ytd_total_header(text) and ytd_col is None:
                ytd_col = j
            if is_ipo_header(text) and ipo_col is None:
                ipo_col = j
            if is_stocks_header(text) and stocks_col is None:
                stocks_col = j
            if is_bonds_header(text) and j not in bond_cols:
                bond_cols.append(j)
    if monthly_col is None:
        return None
    # Total columns never count as breakdown legs, and a column already
    # claimed by IPO/stocks keeps that bucket (e.g. 2026 col G is IPO-grouped ЗГДҮЦ).
    bond_cols = [
        j
        for j in bond_cols
        if j not in (monthly_col, ytd_col, ipo_col, stocks_col)
    ]
    # Unlabeled primary-market columns → IPO (rule of thumb above).
    # Explicit claims (stocks/bonds/totals) always win.
    ipo_cols = [ipo_col] if ipo_col is not None else []
    claimed = {monthly_col, ytd_col, stocks_col, *bond_cols, *ipo_cols}
    band = rows[header_idx : header_idx + 6]
    width = max(len(r) for r in band)
    for j in range(name_col + 1, width):
        if j in claimed:
            continue
        texts = [str(r[j] or "").strip().lower() for r in band if j < len(r)]
        if (
            any(k in t for k in PRIMARY_KEYWORDS for t in texts)
            and not any(x in t for x in PRIMARY_BOND_EXCLUDE for t in texts)
            and any(t for t in texts)
        ):
            ipo_cols.append(j)
    return {
        "header_idx": header_idx,
        "code_col": code_col,
        "name_col": name_col,
        "no_col": no_col,
        "monthly_col": monthly_col,
        "ytd_col": ytd_col,
        "ipo_col": ipo_col,
        "ipo_cols": ipo_cols,
        "stocks_col": stocks_col,
        "bond_cols": bond_cols,
    }


def breakdown_sum(
    get, cols: list[int], sheet_row: int, warnings: list[str], what: str = "bonds"
) -> float | None:
    """Sum breakdown-leg columns for one row. None when there are no such columns;
    also None (with a warning) when a cell holds an error string."""
    if not cols:
        return None
    vals = [to_amount(get(j)) for j in cols]
    if any(v is None for v in vals):
        warnings.append(f"sheet row {sheet_row}: bad {what} cell, {what} left empty")
        return None
    return float(sum(vals))  # type: ignore[arg-type]


def process_file(path: Path, year: int, month: int | None) -> dict:
    rows = read_sheet_rows(path)
    cols = locate_columns(rows)
    if cols is None:
        raise ValueError("table headers not found")
    brokers: list[dict] = []
    market: dict | None = None
    warnings: list[str] = []
    for idx, r in enumerate(rows[cols["header_idx"] + 1 :], start=cols["header_idx"] + 2):
        get = lambda j: r[j] if j < len(r) else None  # noqa: E731
        no, code, name = get(cols["no_col"]), get(cols["code_col"]), get(cols["name_col"])
        if is_int_like(no) and str(code or "").strip():
            monthly = to_amount(get(cols["monthly_col"]))
            if monthly is None:
                warnings.append(f"sheet row {idx}: bad monthly total, skipped")
                continue
            ytd = to_amount(get(cols["ytd_col"])) if cols["ytd_col"] is not None else None
            ipo = breakdown_sum(get, cols["ipo_cols"], idx, warnings, what="ipo")
            stocks = to_amount(get(cols["stocks_col"])) if cols["stocks_col"] is not None else None
            bonds = breakdown_sum(get, cols["bond_cols"], idx, warnings)
            brokers.append(
                {
                    "code": str(code).strip(),
                    "name": clean_name(name),
                    "monthly_total": monthly,
                    "ytd_total": ytd,
                    "ipo": ipo,
                    "stocks": stocks,
                    "bonds": bonds,
                }
            )
        elif isinstance(no, str) and ("нийт" in no.strip().lower() or "total" in no.strip().lower()):
            # The market total row carries values under every column,
            # so the breakdown is read directly — no summation needed.
            market = {
                "monthly_total": to_amount(get(cols["monthly_col"])) or 0.0,
                "ytd_total": to_amount(get(cols["ytd_col"])) if cols["ytd_col"] is not None else None,
                "ipo": breakdown_sum(get, cols["ipo_cols"], idx, warnings, what="ipo"),
                "stocks": to_amount(get(cols["stocks_col"]))
                if cols["stocks_col"] is not None
                else None,
                "bonds": breakdown_sum(get, cols["bond_cols"], idx, warnings),
            }
        elif no is None or str(no or "").strip() in ("", "№"):
            continue  # blank / note rows, or header echoes from merged header cells
        else:
            warnings.append(f"sheet row {idx}: unrecognized row: №={no!r} name={clean_name(name)!r}")
    column_source = {
        "monthly_total_col": cols["monthly_col"],
        "ytd_total_col": cols["ytd_col"],
        "ipo_cols": cols["ipo_cols"],
        "stocks_col": cols["stocks_col"],
        "bond_cols": cols["bond_cols"],
    }
    return {"brokers": brokers, "market": market, "warnings": warnings, **column_source}


def main() -> int:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    records = json.loads(INDEX_PATH.read_text(encoding="utf-8"))

    spread_files = [
        p for p in (RAW_DIR / "files").glob("*") if p.suffix.lower() in (".xls", ".xlsx")
    ]

    def find_spreadsheet(base: str) -> Path | None:
        # Files are stored as <prefix>_<original basename> where prefix is
        # YYYY_MM (or YYYY_annual, or legacy rowNumber) — match the tail.
        for p in spread_files:
            if p.name == base or p.name.endswith("_" + base):
                return p
        return None

    monthly_rows: list[dict] = []
    market_rows: list[dict] = []
    brokers: dict[str, dict] = {}
    file_log: list[dict] = []
    global_warnings: list[str] = []

    for rec in sorted(records, key=lambda r: r.get("rowNumber", 0), reverse=True):
        year, month_n = parse_period(rec.get("meetingTitle", ""))
        period = f"{year}-{month_n:02d}" if year and month_n else (str(year) if year else "unknown")
        base = unquote(urlparse(rec.get("downloadUrl") or "").path.rsplit("/", 1)[-1])
        path = find_spreadsheet(base)
        entry: dict = {
            "rowNumber": rec.get("rowNumber"),
            "period": period,
            "title": rec.get("meetingTitle"),
            "file": path.name if path else None,
            "status": "",
        }
        if year is None or month_n is None:
            entry["status"] = "skipped-no-monthly-period"
            file_log.append(entry)
            continue
        if path is None:
            entry["status"] = "skipped-no-spreadsheet"
            file_log.append(entry)
            continue
        try:
            out = process_file(path, year, month_n)
        except Exception as exc:  # noqa: BLE001 — logged per file, run continues
            entry["status"] = f"failed: {exc}"
            file_log.append(entry)
            continue
        broker_sum = sum(b["monthly_total"] for b in out["brokers"])
        entry["status"] = "ok"
        entry["brokers"] = len(out["brokers"])
        entry["broker_sum"] = broker_sum
        entry["has_ipo_col"] = len(out["ipo_cols"]) > 0
        entry["has_stocks_col"] = out["stocks_col"] is not None
        entry["bond_cols"] = out["bond_cols"]
        if out["market"]:
            entry["market_monthly_total"] = out["market"]["monthly_total"]
            entry["market_ytd_total"] = out["market"].get("ytd_total")
            denom = out["market"]["monthly_total"] or 0.0
            entry["validation_diff"] = (broker_sum - denom) / denom if denom else None
            if entry["validation_diff"] is not None and abs(entry["validation_diff"]) > 0.005:
                msg = f"{period}: broker sum differs from market total by {entry['validation_diff']:.2%}"
                global_warnings.append(msg)
            # breakdown cross-check: broker sums vs the market row's own breakdown cells
            for key in ("ipo", "stocks", "bonds"):
                mval = out["market"].get(key)
                if mval is not None:
                    bsum = sum((b.get(key) or 0.0) for b in out["brokers"])
                    if mval and abs(bsum - mval) / mval > 0.005:
                        global_warnings.append(
                            f"{period}: broker {key} sum differs from market row by {abs(bsum - mval) / mval:.2%}"
                        )
            market_rows.append(
                {"period": period, "year": year, "month": month_n, "source_row": rec.get("rowNumber"), **out["market"]}
            )
        for w in out["warnings"]:
            global_warnings.append(f"{period}: {w}")
        for b in out["brokers"]:
            monthly_rows.append(
                {
                    "period": period,
                    "year": year,
                    "month": month_n,
                    "source_row": rec.get("rowNumber"),
                    "code": b["code"],
                    "name": b["name"],
                    "monthly_total": b["monthly_total"],
                    "ytd_total": b["ytd_total"],
                    "ipo": b["ipo"],
                    "stocks": b["stocks"],
                    "bonds": b["bonds"],
                }
            )
            reg = brokers.setdefault(b["code"], {"names": set(), "periods": []})
            reg["names"].add(b["name"])
            reg["periods"].append(period)
        file_log.append(entry)

    broker_list = [
        {
            "code": code,
            "name": sorted(reg["names"], key=len)[-1],
            "name_variants": sorted(reg["names"]),
            "first_seen": min(reg["periods"]),
            "last_seen": max(reg["periods"]),
            "months_active": len(set(reg["periods"])),
        }
        for code, reg in sorted(brokers.items())
    ]
    monthly_rows.sort(key=lambda r: (r["period"], r["code"]))
    market_rows.sort(key=lambda r: r["period"])

    (PROCESSED_DIR / "brokers.json").write_text(
        json.dumps(broker_list, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (PROCESSED_DIR / "monthly_totals.json").write_text(
        json.dumps(monthly_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (PROCESSED_DIR / "market_totals.json").write_text(
        json.dumps(market_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (PROCESSED_DIR / "_process_manifest.json").write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "files_total": len(records),
                "files_ok": sum(1 for e in file_log if e["status"] == "ok"),
                "brokers_count": len(broker_list),
                "month_count": len({r["period"] for r in monthly_rows}),
                "data_rows": len(monthly_rows),
                "warnings": global_warnings,
                "files": file_log,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    n_ok = sum(1 for e in file_log if e["status"] == "ok")
    print(f"files ok: {n_ok}/{len(records)} | brokers: {len(broker_list)} | "
          f"months: {len({r['period'] for r in monthly_rows})} | rows: {len(monthly_rows)}")
    for e in file_log:
        if e["status"] != "ok":
            print(f"  [{e['status']}] {e['period']}: {e['title']}")
    for w in global_warnings[:20]:
        print(f"  WARN: {w}")
    if len(global_warnings) > 20:
        print(f"  ... +{len(global_warnings) - 20} more warnings")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
