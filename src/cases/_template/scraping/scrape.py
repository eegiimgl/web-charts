"""Scraper for this use-case.

Reads: nothing (fetches from an external source).
Writes: ../data/raw/* — untouched input, never edit by hand afterward.

Usage:
    pip install -r requirements.txt
    python scrape.py
"""

from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent / ".." / "data" / "raw"


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    # TODO: fetch the source and write raw files, e.g.
    #   import json
    #   import requests
    #   data = requests.get(SOURCE_URL, timeout=30).json()
    #   (RAW_DIR / "dataset.json").write_text(json.dumps(data, indent=2))
    raise NotImplementedError("TODO: implement scraping for this use-case")


if __name__ == "__main__":
    main()
