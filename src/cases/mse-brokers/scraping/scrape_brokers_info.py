"""Scraper for MSE member-broker profiles + staff (Боловсон хүчин).

Sources (hybrid — same backend, two frontends):
  listing: https://new.mse.mn/brokers-info (better table: logos, filters,
           whole list in one call)
           columns — №, Симбол, Гишүүн брокер + Үйл ажиллагааны чиглэл:
           Брокер | Дилер | Андеррайтер | Хөрөнгө оруулалтын зөвлөх |
           МҮЦКТ-ийн шууд гишүүн | Онлайн арилжааны платформтой эсэх
  detail:  https://mse.mn/brokers-info/<code> → "Боловсон хүчин" tab (employees).
           The new site has no drill-down, so details come from the old site.

How it works: both Next.js frontends load data through a server action,
so this script calls those actions directly (no browser needed):
  POST <site>/brokers-info  {Next-Action: <ACTION_ID>}
  [{"url": <endpoint>, "parameter": <query>, "config": {"hasToken": false}}]
Endpoints used: brokers (new site), brokerinfo + broker_employee (old site).

Reads: nothing local.
Writes:
  ../data/raw/brokers-info/brokers.json    — all brokers with activity-direction flags
  ../data/raw/brokers-info/details.json    — per-broker {info, employees} keyed by code
  ../data/raw/brokers-info/_manifest.json  — counts, failures, timestamp

NOTE: ACTION_IDs are embedded in each site's JS bundle and can rotate when MSE
redeploys. If calls start failing, grab the fresh id: open the page in devtools
→ Network → click a POST → "Next-Action" request header.

Usage:
    pip install -r requirements.txt
    python scrape_brokers_info.py
    python scrape_brokers_info.py --limit 2   # quick test (first 2 brokers)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("requests is not installed. Run: pip install -r requirements.txt")

# Old site: broker detail pages + staff. New site: listing table.
OLD_ACTION_ID = "6d867ebd99fb6edef2f9537b22668cd0c00a71c2"
OLD_ACTION_URL = "https://mse.mn/brokers-info"
NEW_ACTION_ID = "7ff415db023095225ff93607e69443e9f57133bbcc"
NEW_ACTION_URL = "https://new.mse.mn/brokers-info"
LANG = "mn"
REQUEST_TIMEOUT = 30
PAUSE_BETWEEN_CALLS = 0.3

SCRAPING_DIR = Path(__file__).resolve().parent
OUT_DIR = SCRAPING_DIR.parent / "data" / "raw" / "brokers-info"

HEADERS = {
    "User-Agent": "web-charts (+https://eegii.dev)",
    "Content-Type": "application/json",
}

# listing check-field → Mongolian activity direction
ACTIVITIES = {
    "brokerCheck": "Брокер",
    "tellerCheck": "Дилер",
    "underratorCheck": "Андеррайтер",
    "advisorCheck": "Хөрөнгө оруулалтын зөвлөх",
    "managerCheck": "МҮЦКТ-ийн шууд гишүүн",
    "platformCheck": "Онлайн арилжааны платформтой",
}


def call_action(session: requests.Session, action_url: str, action_id: str, endpoint: str, parameter: str):
    """Invoke a site's data action; return the decoded payload (dict or list)."""
    last_exc: Exception | None = None
    for attempt in range(1, 4):
        try:
            resp = session.post(
                action_url,
                headers={**HEADERS, "Next-Action": action_id},
                json=[{"url": endpoint, "parameter": parameter, "config": {"hasToken": False}}],
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            # The action omits charset, so requests guesses Latin-1 and mangles
            # Cyrillic; worse, raw 0x80-0x9F bytes become illegal JSON controls.
            resp.encoding = "utf-8"
            for line in resp.text.splitlines():
                if line.startswith("1:"):
                    return json.loads(line[2:])
            last_exc = ValueError(f"no flight payload for {endpoint}{parameter}")
        except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
            last_exc = exc
        time.sleep(2 * attempt)
    raise ValueError(f"{endpoint}{parameter} failed after 3 tries: {last_exc}")


def clean(s: object) -> str:
    return str(s or "").replace('"', "").replace('"', "").replace('"', "").strip()


def as_list(payload: object) -> list[dict]:
    return payload if isinstance(payload, list) else []


def as_share(value: object) -> float | None:
    """Ownership share → percent float (API mixes '43' strings and 100 numbers)."""
    if value is None or value == "":
        return None
    try:
        return float(str(value).strip().replace(",", ""))
    except ValueError:
        return None


def fetch_brokers(session: requests.Session) -> list[dict]:
    payload = call_action(
        session, NEW_ACTION_URL, NEW_ACTION_ID, "brokers", f"?lang={LANG}&page=1&perPage=9999"
    )
    rows = payload.get("data", []) if isinstance(payload, dict) else payload
    out = []
    for r in rows:
        out.append(
            {
                "symbol": r.get("symbol"),
                "brokerName": clean(r.get("brokerName")),
                "code": r.get("code"),
                "activities": {
                    label: bool(r.get(field)) for field, label in ACTIVITIES.items()
                },
                "logo": r.get("logo") or None,
            }
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape MSE broker profiles + staff.")
    parser.add_argument("--limit", type=int, default=0, help="only first N brokers (0 = all)")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": HEADERS["User-Agent"]})

    brokers = fetch_brokers(session)
    print(f"brokers listed: {len(brokers)}")
    if args.limit:
        brokers = brokers[: args.limit]

    details: dict[str, dict] = {}
    failures: list[str] = []
    total_employees = 0
    for b in brokers:
        code = b["code"]
        print(f"  [{code}] {b['symbol']}", end=" ", flush=True)
        try:
            info = call_action(
                session, OLD_ACTION_URL, OLD_ACTION_ID, "brokerinfo", f"?code={code}&lang={LANG}"
            )
            time.sleep(PAUSE_BETWEEN_CALLS)
            employees = as_list(
                call_action(
                    session, OLD_ACTION_URL, OLD_ACTION_ID, "broker_employee", f"?code={code}&lang={LANG}"
                )
            )
            time.sleep(PAUSE_BETWEEN_CALLS)
            holders = as_list(
                call_action(
                    session, OLD_ACTION_URL, OLD_ACTION_ID, "broker_shareholder", f"?code={code}&lang={LANG}"
                )
            )
            time.sleep(PAUSE_BETWEEN_CALLS)
            holders_org = as_list(
                call_action(
                    session, OLD_ACTION_URL, OLD_ACTION_ID, "broker_shareholder_org", f"?code={code}&lang={LANG}"
                )
            )
            time.sleep(PAUSE_BETWEEN_CALLS)
            board = as_list(
                call_action(
                    session, OLD_ACTION_URL, OLD_ACTION_ID, "broker_board_member", f"?code={code}&lang={LANG}"
                )
            )
            time.sleep(PAUSE_BETWEEN_CALLS)
            details[str(code)] = {
                "symbol": b["symbol"],
                "brokerName": b["brokerName"],
                "info": info if isinstance(info, dict) else {},
                "employees": [
                    {"fullName": clean(e.get("fullName")), "position": clean(e.get("position"))}
                    for e in employees
                ],
                "shareholders_individual": [
                    {
                        "fullName": clean(h.get("fullName")),
                        "position": clean(h.get("position")),
                        "share": as_share(h.get("stockSize")),
                    }
                    for h in holders
                ],
                "shareholders_org": [
                    {"fullName": clean(h.get("fullName")), "share": as_share(h.get("stockSize"))}
                    for h in holders_org
                ],
                "board": [
                    {"fullName": clean(m.get("fullName")), "position": clean(m.get("position"))}
                    for m in board
                ],
            }
            d = details[str(code)]
            total_employees += len(d["employees"])
            print(f"({len(d['employees'])} staff, {len(d['shareholders_individual'])}+{len(d['shareholders_org'])} holders, {len(d['board'])} board)")
        except (requests.RequestException, ValueError) as exc:
            print(f"FAILED: {exc}")
            failures.append(str(code))

    (OUT_DIR / "brokers.json").write_text(
        json.dumps(brokers, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "details.json").write_text(
        json.dumps(details, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "_manifest.json").write_text(
        json.dumps(
            {
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "listing_source": "https://new.mse.mn/brokers-info",
                "details_source": "https://mse.mn/brokers-info/<code>",
                "brokers": len(brokers),
                "with_details": len(details),
                "with_logo": sum(1 for b in brokers if b.get("logo")),
                "total_employees": total_employees,
                "total_holders_individual": sum(len(d.get("shareholders_individual", [])) for d in details.values()),
                "total_holders_org": sum(len(d.get("shareholders_org", [])) for d in details.values()),
                "total_board": sum(len(d.get("board", [])) for d in details.values()),
                "failed_codes": failures,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"done: {len(details)}/{len(brokers)} details, {total_employees} employees, {len(failures)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
