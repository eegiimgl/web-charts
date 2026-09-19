"""Scraper for the mse-brokers use-case.

Source: https://mse.mn/report-and-research
Category (left nav): "Гишүүн компаниудын арилжааны тайлан мэдээ"
  = `broker_trading_report` tab — the one with the "Файл" column.

How it works: the page is a Next.js app whose table is fed by a JSON API.
This script talks to that API directly (no browser needed):
  GET https://mse.mn/api/broker/trading_report?lang=mn&page=N&perPage=100

Reads: nothing local.
Writes:
  ../data/raw/reports.json    — full listing (title + file URLs, all pages)
  ../data/raw/files/          — downloaded files:
                                Файл column (downloadUrl, .xlsx) + Хавсралт (pdf)
  ../data/raw/_manifest.json  — what was downloaded, where, and when

Usage:
    pip install -r requirements.txt
    python scrape.py                  # list all pages + download everything
    python scrape.py --list-only      # just print totals, download nothing
    python scrape.py --refresh        # re-download even if the file exists
    python scrape.py --limit-pages 1  # only first page (quick test)

Re-runs are safe: existing files are skipped unless --refresh is given.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

try:
    import requests
except ImportError:
    sys.exit("requests is not installed. Run: pip install -r requirements.txt")

LIST_URL = "https://mse.mn/api/broker/trading_report"
LANG = "mn"
PER_PAGE = 100
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
PAUSE_BETWEEN_DOWNLOADS = 0.3

SCRAPING_DIR = Path(__file__).resolve().parent
RAW_DIR = SCRAPING_DIR.parent / "data" / "raw"
FILES_DIR = RAW_DIR / "files"
INDEX_PATH = RAW_DIR / "reports.json"
MANIFEST_PATH = RAW_DIR / "_manifest.json"

HEADERS = {"User-Agent": "web-charts (+https://eegii.dev)"}


def fetch_page(session: requests.Session, page: int) -> dict:
    resp = session.get(
        LIST_URL,
        params={"lang": LANG, "page": page, "perPage": PER_PAGE},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def download(session: requests.Session, url: str, dest: Path) -> bool:
    """Stream-download url to dest. Returns True on success."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with session.get(url, timeout=REQUEST_TIMEOUT, stream=True) as resp:
                resp.raise_for_status()
                dest.parent.mkdir(parents=True, exist_ok=True)
                with open(dest, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=1024 * 256):
                        if chunk:
                            f.write(chunk)
            return True
        except requests.RequestException as exc:
            print(f"    retry {attempt}/{MAX_RETRIES} for {url}: {exc}")
            time.sleep(2 * attempt)
    return False


def file_prefix(title: str, row_number: int) -> str:
    """Local filename prefix from the report title: YYYY_MM, YYYY_annual, or rowNumber fallback."""
    m = re.search(r"(\d{4})\s*оны\s*(?:(\d+)\s*(?:-р|дүгээр|дугаар)\s*сарын)?", title or "")
    if m and m.group(2):
        return f"{int(m.group(1)):04d}_{int(m.group(2)):02d}"
    if m:
        return f"{int(m.group(1)):04d}_annual"
    return f"{row_number:04d}"


def safe_name(row_number: int, url: str, title: str = "") -> str:
    base = unquote(urlparse(url).path.rsplit("/", 1)[-1]) or "file"
    return f"{file_prefix(title, row_number)}_{base}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape MSE member-company trading reports.")
    parser.add_argument("--list-only", action="store_true", help="list pages, download nothing")
    parser.add_argument("--refresh", action="store_true", help="re-download existing files")
    parser.add_argument("--limit-pages", type=int, default=0, help="only scrape first N pages (0 = all)")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update(HEADERS)

    # 1. Walk all pages of the listing.
    records: list[dict] = []
    page = 1
    last_page = 1
    while True:
        payload = fetch_page(session, page)
        batch = payload.get("data", [])
        last_page = payload.get("last_page", page)
        total = payload.get("total")
        print(f"page {page}/{last_page} (total records: {total}): {len(batch)} rows")
        for row in batch:
            records.append(
                {
                    "rowNumber": row.get("rowNumber"),
                    "meetingTitle": row.get("meetingTitle"),
                    "pdf": row.get("pdf"),
                    "downloadUrl": row.get("downloadUrl"),
                    "page": page,
                }
            )
        if args.limit_pages and page >= args.limit_pages:
            break
        if page >= last_page or not batch:
            break
        page += 1

    INDEX_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote listing: {INDEX_PATH} ({len(records)} records)")

    if args.list_only:
        return 0

    # 2. Download every file from the Файл column (xlsx) + the Хавсралт pdf.
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    failures: list[str] = []
    downloaded = skipped = 0
    for rec in records:
        for kind in ("downloadUrl", "pdf"):
            url = rec.get(kind)
            if not url:
                continue
            dest = FILES_DIR / safe_name(rec["rowNumber"] or 0, url, rec.get("meetingTitle", ""))
            rel = dest.relative_to(RAW_DIR).as_posix()
            if dest.exists() and dest.stat().st_size > 0 and not args.refresh:
                skipped += 1
                manifest.append({**rec, "kind": kind, "file": rel, "status": "skipped-exists"})
                continue
            print(f"  downloading [{kind}] {rec['meetingTitle']}")
            ok = download(session, url, dest)
            time.sleep(PAUSE_BETWEEN_DOWNLOADS)
            if ok:
                downloaded += 1
                manifest.append({**rec, "kind": kind, "file": rel, "status": "ok"})
            else:
                manifest.append({**rec, "kind": kind, "file": rel, "status": "failed"})
                failures.append(url)

    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "source": LIST_URL,
                "total_records": len(records),
                "downloaded": downloaded,
                "skipped": skipped,
                "failed": len(failures),
                "files": manifest,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"done: {downloaded} downloaded, {skipped} skipped, {len(failures)} failed")
    if failures:
        print("FAILED:")
        for url in failures:
            print(f"  {url}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
