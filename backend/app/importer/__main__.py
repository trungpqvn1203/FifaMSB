"""CLI entrypoint for CSV player import.

Usage:
    uv run python -m app.importer --file data/sample_players.csv
"""

import argparse
import asyncio
import sys
from pathlib import Path

from app.common.clock import SystemClock
from app.db import AsyncSessionFactory, engine
from app.importer.pipeline import run_import_pipeline
from app.player.pool_lock import DefaultPoolLockPolicy


async def main_async(file_path: str) -> None:
    path = Path(file_path)
    if not path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Starting import from {file_path}...")
    clock = SystemClock()
    policy = DefaultPoolLockPolicy()

    async with AsyncSessionFactory() as session:
        report = await run_import_pipeline(
            session=session,
            clock=clock,
            pool_lock_policy=policy,
            source=str(path),
        )

    print("Import completed successfully!")
    print(f"  Rows read:     {report.rows_read}")
    print(f"  Rows inserted: {report.rows_inserted}")
    print(f"  Rows updated:  {report.rows_updated}")
    print(f"  Rows skipped:  {report.rows_skipped}")
    if report.errors:
        print(f"  Warnings/Errors ({len(report.errors)}):")
        for err in report.errors[:10]:
            print(f"    - {err}")
        if len(report.errors) > 10:
            print(f"    ... and {len(report.errors) - 10} more")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import FC Online player cards from CSV.")
    parser.add_argument("--file", required=True, help="Path to CSV file to import")
    args = parser.parse_args()

    try:
        asyncio.run(main_async(args.file))
    finally:
        asyncio.run(engine.dispose())


if __name__ == "__main__":
    main()
