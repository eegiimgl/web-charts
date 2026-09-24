"""Processor for the oyu-tolgoi use-case: price forecast → chart-ready JSON.

Reads: ../data/raw/price-forecast.xlsx, sheet "Sheet2 (2)" (never modifies it).
       Sheet1 / Sheet2 are older drafts of the same model (end 2032,
       single scenario) and are intentionally ignored.
Writes (committed):
  ../data/processed/forecast.json — long-format series:
    {scenario, metal, kind, unit, grand_total, yearly: {year: value}}

Sheet "Sheet2 (2)" layout (0-indexed rows, years 2025–2033 in columns):
  - "OT HNL1 Case" payable volumes (t): Copper r2, Gold r3, Silver r4
    (col B = Grand Total)
  - "TRQ 2022 Case" prices ($/t): Copper r8, Gold r9, Silver r10
  - "Gross Revenue" TRQ case ($M): Copper r13, Gold r14, Silver r15, Total r16
  - "2026 Price Scenario" flat prices ($/t): Copper r20, Gold r21, Silver r22
  - "2026 Price Scen." revenue ($M): Copper r25, Gold r26, Silver r27, Total r28

Cross-checked: volume × price ≈ revenue (e.g. 2025 Cu 330207 t × 9663 $/t
≈ $3191M). Gold 2026-scenario price 140,400,000 $/t ≈ $4355/oz — plausible.

Usage:
    pip install -r requirements.txt  # needs openpyxl
    python process.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

SCRAPING_DIR = Path(__file__).resolve().parent
RAW_FILE = SCRAPING_DIR.parent / "data" / "raw" / "price-forecast.xlsx"
PROCESSED_DIR = SCRAPING_DIR.parent / "data" / "processed"
SHEET = "Sheet2 (2)"

METALS = ("copper", "gold", "silver")


def cell(rows: list[list[object]], r: int, c: int) -> object:
    return rows[r][c] if r < len(rows) and c < len(rows[r]) else None


def num(v: object, where: str) -> float:
    if isinstance(v, bool) or v is None:
        raise ValueError(f"non-numeric at {where}: {v!r}")
    try:
        return float(str(v).strip().replace(",", ""))
    except ValueError:
        raise ValueError(f"non-numeric at {where}: {v!r}")


def main() -> int:
    import openpyxl

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.load_workbook(RAW_FILE, data_only=True)
    ws = wb[SHEET]
    rows = [[c.value for c in r] for r in ws.iter_rows()]

    def label(r: int) -> str:
        return str(cell(rows, r, 0) or "").strip().lower()

    # Layout assertions — fail loudly if the sheet drifts.
    assert label(2) == "copper" and label(8) == "copper $/t", "volumes/prices block moved"
    assert label(13) == "copper" and label(16) == "total", "TRQ revenue block moved"
    assert label(20) == "copper" and label(25) == "copper" and label(28) == "total", (
        "2026 scenario block moved"
    )
    # Year columns are dynamic: header row 1 holds Grand Total in col B,
    # then consecutive years (2025–2050) to the right.
    header_years: list[int] = []
    for c in range(2, len(rows[1])):
        try:
            header_years.append(int(num(cell(rows, 1, c), f"header col {c}")))
        except ValueError:
            break
    assert header_years[0] == 2025 and header_years == list(
        range(header_years[0], header_years[-1] + 1)
    ), f"year header changed: {header_years}"
    YEARS = header_years
    year_cols = list(range(2, 2 + len(YEARS)))

    def yearly(r: int) -> dict[int, float]:
        return {y: round(num(cell(rows, r, c), f"row {r+1} col {c}"), 4) for c, y in zip(year_cols, YEARS)}

    series: list[dict] = []

    def add(scenario: str, metal: str, kind: str, unit: str, row: int, grand_total: bool = True):
        entry: dict = {
            "scenario": scenario,
            "metal": metal,
            "kind": kind,
            "unit": unit,
            "yearly": yearly(row),
        }
        if grand_total:
            entry["grand_total"] = round(num(cell(rows, row, 1), f"GT row {row+1}"), 4)
        series.append(entry)

    for i, metal in enumerate(METALS):
        add("ot-hnl1", metal, "volume", "t", 2 + i)
    for i, metal in enumerate(METALS):
        add("trq-2022", metal, "price", "$/t", 8 + i, grand_total=False)
        add("trq-2022", metal, "revenue", "$M", 13 + i)
    add("trq-2022", "total", "revenue", "$M", 16)
    for i, metal in enumerate(METALS):
        add("scenario-2026", metal, "price", "$/t", 20 + i, grand_total=False)
        add("scenario-2026", metal, "revenue", "$M", 25 + i)
    add("scenario-2026", "total", "revenue", "$M", 28)

    # Validation: volume × price ≈ revenue (TRQ case, copper 2025).
    cu = next(s for s in series if s["scenario"] == "ot-hnl1" and s["metal"] == "copper" and s["kind"] == "volume")
    cp = next(s for s in series if s["scenario"] == "trq-2022" and s["metal"] == "copper" and s["kind"] == "price")
    cr = next(s for s in series if s["scenario"] == "trq-2022" and s["metal"] == "copper" and s["kind"] == "revenue")
    expect = cu["yearly"][2025] * cp["yearly"][2025] / 1e6
    diff = abs(expect - cr["yearly"][2025]) / cr["yearly"][2025]
    assert diff < 0.001, f"volume×price check failed: {expect} vs {cr['yearly'][2025]}"

    (PROCESSED_DIR / "forecast.json").write_text(
        json.dumps(
            {
                "source_sheet": SHEET,
                "scenarios": ["trq-2022", "scenario-2026"],
                "metals": list(METALS),
                "years": YEARS,
                "series": series,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    (PROCESSED_DIR / "_forecast_manifest.json").write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source_file": "price-forecast.xlsx",
                "source_sheet": SHEET,
                "ignored_sheets": ["Sheet1", "Sheet2"],
                "series_count": len(series),
                "volume_x_price_check": f"ok (diff {diff:.4%})",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"series: {len(series)} | years {YEARS[0]}–{YEARS[-1]} | check: volume×price diff {diff:.4%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
