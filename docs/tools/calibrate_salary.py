"""Synthetic salary calibration helper for FC Online Draft System.

This script is an offline, standalone tool (NOT part of the backend application)
used to generate or calibrate synthetic player salaries when raw CSV exports
lack salary data or require tier re-balancing.

Usage:
    python docs/tools/calibrate_salary.py --input raw_players.csv --output calibrated_players.csv
    python docs/tools/calibrate_salary.py --input raw_players.csv --output calibrated_players.csv --min-salary 5 --max-salary 60 --curve exponential
"""

from __future__ import annotations

import argparse
import csv
import math
import sys
from pathlib import Path


def calculate_salary_by_tier(rating: int) -> int:
    """Map player rating (OVR) to a realistic FC Online salary tier."""
    if rating >= 115:
        return 58 + min(rating - 115, 2)  # 58 - 60
    elif rating >= 110:
        return 48 + int((rating - 110) / 5.0 * 9)  # 48 - 57
    elif rating >= 105:
        return 38 + int((rating - 105) / 5.0 * 9)  # 38 - 47
    elif rating >= 100:
        return 28 + int((rating - 100) / 5.0 * 9)  # 28 - 37
    elif rating >= 95:
        return 18 + int((rating - 95) / 5.0 * 9)  # 18 - 27
    elif rating >= 90:
        return 10 + int((rating - 90) / 5.0 * 7)  # 10 - 17
    else:
        return max(5, 5 + int((rating - 75) / 15.0 * 4))  # 5 - 9


def calculate_salary_by_curve(
    rating: int,
    min_rating: int,
    max_rating: int,
    min_salary: int = 5,
    max_salary: int = 60,
    exponent: float = 1.8,
) -> int:
    """Calculate salary using a non-linear power curve over rating range."""
    if max_rating <= min_rating:
        return min_salary
    clamped_rating = max(min_rating, min(rating, max_rating))
    normalized = (clamped_rating - min_rating) / float(max_rating - min_rating)
    curved = math.pow(normalized, exponent)
    calculated = round(min_salary + (max_salary - min_salary) * curved)
    return max(1, calculated)


def process_csv(
    input_path: Path,
    output_path: Path,
    mode: str = "tier",
    min_salary: int = 5,
    max_salary: int = 60,
    default_salary: int = 15,
) -> None:
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    rows: list[dict[str, str]] = []
    with input_path.open(mode="r", encoding="utf-8-sig", newline="") as infile:
        reader = csv.DictReader(infile)
        if not reader.fieldnames:
            print("Error: CSV has no header row.", file=sys.stderr)
            sys.exit(1)
        fieldnames = list(reader.fieldnames)
        if "salary" not in fieldnames:
            fieldnames.append("salary")

        ratings: list[int] = []
        for row in reader:
            rows.append(row)
            raw_rating = row.get("rating", "").strip()
            if raw_rating.isdigit():
                ratings.append(int(raw_rating))

    min_rating = min(ratings) if ratings else 80
    max_rating = max(ratings) if ratings else 115

    updated_count = 0
    preserved_count = 0

    for row in rows:
        existing_salary = row.get("salary", "").strip()
        # If valid integer salary already exists, preserve it
        if existing_salary.isdigit() and int(existing_salary) >= 1:
            preserved_count += 1
            continue

        raw_rating = row.get("rating", "").strip()
        if raw_rating.isdigit():
            rating_val = int(raw_rating)
            if mode == "tier":
                calibrated = calculate_salary_by_tier(rating_val)
            else:
                calibrated = calculate_salary_by_curve(
                    rating_val,
                    min_rating=min_rating,
                    max_rating=max_rating,
                    min_salary=min_salary,
                    max_salary=max_salary,
                )
        else:
            calibrated = default_salary

        row["salary"] = str(calibrated)
        updated_count += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open(mode="w", encoding="utf-8", newline="") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Salary Calibration Complete:")
    print(f"  Total rows processed : {len(rows)}")
    print(f"  Salaries preserved    : {preserved_count}")
    print(f"  Salaries generated    : {updated_count}")
    print(f"  Output saved to       : {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Offline tool to generate/calibrate synthetic player salaries for draft datasets."
    )
    parser.add_argument("--input", "-i", type=Path, required=True, help="Input CSV path")
    parser.add_argument("--output", "-o", type=Path, required=True, help="Output CSV path")
    parser.add_argument(
        "--mode",
        choices=["tier", "curve"],
        default="tier",
        help="Salary calculation mode (default: tier)",
    )
    parser.add_argument(
        "--min-salary",
        type=int,
        default=5,
        help="Minimum salary bound (default: 5, must be >= 1)",
    )
    parser.add_argument(
        "--max-salary",
        type=int,
        default=60,
        help="Maximum salary bound (default: 60)",
    )
    parser.add_argument(
        "--default-salary",
        type=int,
        default=15,
        help="Fallback salary for rows missing rating (default: 15)",
    )

    args = parser.parse_args()
    if args.min_salary < 1:
        parser.error("--min-salary must be >= 1")

    process_csv(
        input_path=args.input,
        output_path=args.output,
        mode=args.mode,
        min_salary=args.min_salary,
        max_salary=args.max_salary,
        default_salary=args.default_salary,
    )


if __name__ == "__main__":
    main()
