"""Processor for this use-case.

Reads: ../data/raw/* (never modifies it).
Writes: ../data/processed/*.json — chart-ready output, committed to the repo.
        The web app only reads from data/processed, never from data/raw.

Usage:
    python process.py
"""

from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent / ".." / "data" / "raw"
PROCESSED_DIR = Path(__file__).resolve().parent / ".." / "data" / "processed"


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    # TODO: read raw files, clean/aggregate/shape, write chart-ready JSON, e.g.
    #   import json
    #   raw = json.loads((RAW_DIR / "dataset.json").read_text())
    #   processed = {"months": [...], "values": [...]}
    #   (PROCESSED_DIR / "monthly.json").write_text(json.dumps(processed, indent=2))
    raise NotImplementedError("TODO: implement processing for this use-case")


if __name__ == "__main__":
    main()
