"""One-time migration: rename data/raw/files/* to period-based names.

From: <rowNumber>_<original basename>   (e.g. 0001_6aa76683efd58_0EU5FwxmRq.xlsx)
To:   YYYY_MM_<original basename>       (e.g. 2026_08_6aa76683efd58_0EU5FwxmRq.xlsx)
      YYYY_annual_<basename>            for annual reports without a month

The period comes from reports.json titles. New scrapes already use the new
scheme (see scrape.py::file_prefix), so this runs once.

Also patches ../data/raw/_manifest.json local paths to the new names.

Usage:
    python rename_raw.py            # dry-run: print planned renames
    python rename_raw.py --apply    # actually rename
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SCRAPING_DIR = Path(__file__).resolve().parent
RAW_DIR = SCRAPING_DIR.parent / "data" / "raw"
FILES_DIR = RAW_DIR / "files"
INDEX_PATH = RAW_DIR / "reports.json"
MANIFEST_PATH = RAW_DIR / "_manifest.json"

TITLE_RE = re.compile(r"(\d{4})\s*оны\s*(?:(\d+)\s*(?:-р|дүгээр|дугаар)\s*сарын)?")
OLD_PREFIX_RE = re.compile(r"^(\d+?)_(.+)$")


def period_of(title: str) -> str:
    m = TITLE_RE.search(title or "")
    if m and m.group(2):
        return f"{int(m.group(1)):04d}_{int(m.group(2)):02d}"
    if m:
        return f"{int(m.group(1)):04d}_annual"
    return "unknown"


def main() -> int:
    parser = argparse.ArgumentParser(description="Rename raw files to YYYY_MM_* scheme.")
    parser.add_argument("--apply", action="store_true", help="actually rename (default: dry-run)")
    args = parser.parse_args()

    records = {r.get("rowNumber"): r for r in json.loads(INDEX_PATH.read_text(encoding="utf-8"))}
    renames: list[tuple[Path, Path]] = []
    for path in sorted(FILES_DIR.iterdir()):
        if not path.is_file():
            continue
        m = OLD_PREFIX_RE.match(path.name)
        if not m:
            print(f"  skip (no rowNumber prefix): {path.name}")
            continue
        rec = records.get(int(m.group(1)))
        if rec is None:
            print(f"  skip (rowNumber not in reports.json): {path.name}")
            continue
        new_name = f"{period_of(rec.get('meetingTitle', ''))}_{m.group(2)}"
        if new_name != path.name:
            renames.append((path, path.with_name(new_name)))

    targets = [t.name for _, t in renames]
    dupes = {t for t in targets if targets.count(t) > 1}
    if dupes:
        print("ABORT: name collisions (same month, same basename):")
        for d in sorted(dupes):
            print(f"  {d}")
        return 1

    print(f"{len(renames)} files to rename")
    for old, new in renames[:10]:
        print(f"  {old.name}\n    -> {new.name}")
    if len(renames) > 10:
        print(f"  ... +{len(renames) - 10} more")

    if not args.apply:
        print("dry-run only — rerun with --apply to rename")
        return 0

    mapping = {}
    for old, new in renames:
        old.rename(new)
        mapping[f"files/{old.name}"] = f"files/{new.name}"
    print(f"renamed {len(renames)} files")

    if MANIFEST_PATH.exists() and mapping:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        for f in manifest.get("files", []):
            if f.get("file") in mapping:
                f["file"] = mapping[f["file"]]
        MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"patched {len(mapping)} paths in _manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
