"""Pipeline coordinator for the ETL import process."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.clock import Clock
from app.common.errors import PoolLocked
from app.importer.extract import extract_csv_chunks
from app.importer.load import load_chunk
from app.importer.transform import transform_chunk
from app.player.pool_lock import PoolLockPolicy


class ImportReport(BaseModel):
    """Execution summary returned by the importer pipeline."""

    model_config = ConfigDict(populate_by_name=True)

    rows_read: int = Field(default=0, serialization_alias="rowsRead")
    rows_inserted: int = Field(default=0, serialization_alias="rowsInserted")
    rows_updated: int = Field(default=0, serialization_alias="rowsUpdated")
    rows_skipped: int = Field(default=0, serialization_alias="rowsSkipped")
    errors: list[str] = Field(default_factory=list)


async def run_import_pipeline(
    session: AsyncSession,
    clock: Clock,
    pool_lock_policy: PoolLockPolicy,
    source: Any,
    chunk_size: int = 100,
) -> ImportReport:
    """Execute the full Extract-Transform-Load pipeline on a CSV source.

    Raises:
        PoolLocked: If a draft session is currently active (PICKING or PAUSED).
    """
    if await pool_lock_policy.is_locked():
        raise PoolLocked()

    report = ImportReport()
    now = clock.now()

    for chunk in extract_csv_chunks(source, chunk_size=chunk_size):
        records = chunk.to_dict(orient="records")
        report.rows_read += len(records)

        valid_rows, skip_errors = transform_chunk(records)
        report.rows_skipped += len(skip_errors)
        report.errors.extend(skip_errors)

        if valid_rows:
            inserted, updated = await load_chunk(session, valid_rows, now)
            report.rows_inserted += inserted
            report.rows_updated += updated

    await session.commit()
    return report
