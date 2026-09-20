"""Process broker staff data (Боловсон хүчин) into chart-ready files.

Reads: ../data/raw/brokers-info/details.json (per-broker employee lists)
Writes (committed):
  ../data/processed/positions.json       — every distinct title: {position, count, category}
  ../data/processed/employee_stats.json  — {by_category, by_broker[]}

Titles are messy (case variants, typos, combined roles like "Брокер, Шинжээч"),
so categorization is keyword-based, first matching category wins
(CATEGORY_RULES order = priority). Review the `other` bucket in positions.json
after each run and extend the rules.

Usage:
    python process_brokers_info.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

SCRAPING_DIR = Path(__file__).resolve().parent
RAW_DETAILS = SCRAPING_DIR.parent / "data" / "raw" / "brokers-info" / "details.json"
PROCESSED_DIR = SCRAPING_DIR.parent / "data" / "processed"

# (category, mongolian label, keywords matched against the lowercased title)
CATEGORY_RULES: list[tuple[str, str, tuple[str, ...]]] = [
    ("executive", "Удирдлага", ("захир", "director", "president", " vice", " vp", "гүйцэтгэх", "туз-ийн дарга", "нарийн бичгийн дарга", "ерөнхий менежер")),
    ("broker", "Брокер / Дилер", ("брокер", "broker", "дилер", "диллер", "dealer", "trader", "арилжаа", "trading")),
    ("underwriter", "Андеррайтер", ("андеррайтер", "underwrit")),
    ("analyst", "Шинжээч / Судалгаа", ("шинжээч", "analyst", "аналист", "analytic", "судалгаа", "research", "economist", "эдийн засагч", "ассоши", "ассоси", "ассоше", "associ")),
    ("compliance", "Хяналт / Эрсдэл / Хууль", ("комплаенс", "комплайнс", "compliance", "хяналт", "аудит", "audit", "эрсдэл", "risk", "хууль", "хуулийн", "эрх зүй", "хуульч")),
    ("finance", "Санхүү / Нягтлан", ("нягтлан", "ня-бо", "санхүү", "financ")),
    ("advisor", "Зөвлөх", ("зөвлөх", "зөвлөх", "advis", "хөрөнгө оруулалт", "investment")),
    ("it", "Мэдээллийн технологи", (" it ", "ай ти", "мэдээлэл технологи", "технологи", "программ", "хөгжүүлэгч", "инженер", "engineer", "систем", "system", "software", "develop")),
    ("operations", "Үйл ажиллагаа / Бэк-офис", ("номинал", "nominal", "клиринг", "clearing", "backoffice", "back office", "төлбөр тооцоо", "тооцоо", "данс хариуцсан", "номинал хариуцсан", "бүртгэл")),
    ("marketing", "Маркетинг", ("маркетинг", "marketing", "маркет", "маркер", "дизайн", "design", "график", "graphic", "контент", "content", "бренд", "brand")),
    ("client_service", "Харилцагчийн үйлчилгээ", ("харилцагч", "client", "customer", "vip", "вип", "мэдээллийн ажилтан", "мэдээлийн ажилтан")),
    ("hr", "Хүний нөөц", ("хүний нөөц", "human resource", "hr ")),
    ("admin", "Захиргаа / Туслах", ("оффис", "office", "жолооч", "driver", "орчуулагч", "translator", "туслах", "assistant", "ресепшн", "нарийн бичиг")),
]

def categorize(title: str) -> str:
    # padded so spaced keywords (" it ") match whole words only
    t = f" {title.strip().lower()} "
    for category, _label, keywords in CATEGORY_RULES:
        if any(kw in t for kw in keywords):
            return category
    return "other"


def main() -> int:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    details = json.loads(RAW_DETAILS.read_text(encoding="utf-8"))

    counts: Counter[str] = Counter()
    first_seen: dict[str, str] = {}
    for b in details.values():
        for e in b.get("employees", []):
            pos = (e.get("position") or "").strip()
            counts[pos] += 1
            first_seen.setdefault(pos, b["symbol"])

    labels = {cat: label for cat, label, _ in CATEGORY_RULES}
    positions = [
        {"position": pos or "(empty)", "count": n, "category": categorize(pos), "example_broker": first_seen[pos]}
        for pos, n in counts.most_common()
    ]
    (PROCESSED_DIR / "positions.json").write_text(
        json.dumps(positions, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    by_category: Counter[str] = Counter()
    by_broker = []
    for code, b in sorted(details.items(), key=lambda kv: kv[1]["symbol"]):
        cats: Counter[str] = Counter()
        for e in b.get("employees", []):
            cats[categorize((e.get("position") or "").strip())] += 1
        by_category.update(cats)
        by_broker.append(
            {
                "symbol": b["symbol"],
                "name": b["brokerName"],
                "total": sum(cats.values()),
                "by_category": dict(sorted(cats.items())),
            }
        )

    total = sum(by_category.values())
    # Fixed column order = categories by overall size (desc).
    columns = sorted(by_category, key=lambda c: -by_category[c])
    matrix = []
    for b in by_broker:
        row: dict = {"symbol": b["symbol"], "name": b["name"], "total": b["total"]}
        for cat in columns:
            row[cat] = b["by_category"].get(cat, 0)
        matrix.append(row)

    (PROCESSED_DIR / "employee_stats.json").write_text(
        json.dumps(
            {
                "total": total,
                "categories": [
                    {"category": cat, "label": labels.get(cat, "Бусад")} for cat in columns
                ],
                "by_category": [
                    {
                        "category": cat,
                        "label": labels.get(cat, "Бусад"),
                        "count": by_category[cat],
                        "share": round(by_category[cat] / total, 4) if total else 0,
                    }
                    for cat in columns
                ],
                # Full broker × category matrix: every row carries every
                # category column (0 where the broker has none).
                "by_broker": matrix,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"positions: {len(positions)} distinct, {total} employees")
    for cat in sorted(set(by_category) | {"other"}):
        print(f"  {by_category[cat]:3d}  {cat} ({labels.get(cat, 'Бусад')})")
    print("--- 'other' bucket review ---")
    for p in positions:
        if p["category"] == "other":
            print(f"  {p['count']:3d}  {p['position']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
