"""Extractor module: stream CSV in chunks using pandas."""

from collections.abc import Iterator
from typing import Any

import pandas as pd


def extract_csv_chunks(
    source: Any,
    chunk_size: int = 100,
) -> Iterator[pd.DataFrame]:
    """Read CSV file or buffer in streaming chunks to avoid unbounded memory usage.

    All columns are read as strings first to allow the Transform step to validate
    and convert types cleanly.
    """
    yield from pd.read_csv(
        source,
        chunksize=chunk_size,
        dtype=str,
        keep_default_na=False,
    )
