"""Pipeline for synchronizing player cards directly from Nexon FC Online."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.clock import Clock
from app.common.errors import PoolLocked
from app.importer.load import load_chunk
from app.importer.nexon_client import NexonClient
from app.importer.nexon_meta import NexonMetadataRegistry, format_player_name
from app.importer.nexon_parser import parse_player_ability_html
from app.importer.pipeline import ImportReport
from app.importer.transform import ValidatedPlayerRow
from app.player.pool_lock import PoolLockPolicy

logger = logging.getLogger(__name__)


async def run_nexon_sync_pipeline(
    session: AsyncSession,
    clock: Clock,
    pool_lock_policy: PoolLockPolicy,
    spids: list[int] | None = None,
    season_id: int | None = None,
    limit: int | None = None,
    client: NexonClient | None = None,
    chunk_size: int = 50,
) -> ImportReport:
    """Fetch and upsert player cards from Nexon FC Online DataCenter.

    Can sync by a specific list of `spids`, or by `season_id`.

    Raises:
        PoolLocked: If a draft session is currently active (PICKING or PAUSED).
    """
    if await pool_lock_policy.is_locked():
        raise PoolLocked()

    if client is None:
        client = NexonClient()

    registry = NexonMetadataRegistry.get_instance()
    registry.initialize()

    # Determine SPIDs to sync
    target_spids: list[int] = []
    if season_id is not None:
        target_spids = registry.get_spids_for_season(season_id, limit=limit)
    elif spids:
        target_spids = list(spids)
        if limit is not None and limit > 0:
            target_spids = target_spids[:limit]

    report = ImportReport()
    if not target_spids:
        report.errors.append("Không có mã thẻ SPID nào để đồng bộ.")
        return report

    now = clock.now()

    # Pre-fetch season metadata if available
    season_map: dict[int, str] = {}
    try:
        raw_seasons = await client.fetch_season_metadata()
        for s in raw_seasons:
            s_id = s.get("seasonId")
            c_name = s.get("className", "")
            if s_id is not None and c_name:
                short_code = c_name.split("(")[0].strip() if "(" in c_name else c_name.strip()
                season_map[int(s_id)] = short_code.upper()
    except Exception as exc:
        logger.warning("Could not pre-fetch Nexon season metadata: %s", exc)

    batch_rows: list[ValidatedPlayerRow] = []

    for spid in target_spids:
        report.rows_read += 1
        s_id = spid // 1_000_000
        fallback_season = season_map.get(s_id)
        english_name = registry.get_english_name(spid)

        try:
            html = await client.fetch_player_ability_html(spid)
            if not html:
                report.rows_skipped += 1
                report.errors.append(f"SPID {spid}: Failed to fetch ability HTML from Nexon")
                continue

            card = parse_player_ability_html(
                spid=spid,
                html=html,
                fallback_name=english_name,
                fallback_season_code=fallback_season,
            )
            if not card:
                report.rows_skipped += 1
                report.errors.append(f"SPID {spid}: Could not parse card HTML")
                continue

            # Prioritize English name if present, and format Title Case
            if english_name:
                card.name = format_player_name(english_name)
            elif card.name:
                card.name = format_player_name(card.name)

            batch_rows.append(card.to_validated_row())

            if len(batch_rows) >= chunk_size:
                inserted, updated = await load_chunk(session, batch_rows, now)
                report.rows_inserted += inserted
                report.rows_updated += updated
                batch_rows.clear()

        except Exception as exc:
            report.rows_skipped += 1
            report.errors.append(f"SPID {spid}: Unexpected error: {exc}")

    # Process remaining rows
    if batch_rows:
        inserted, updated = await load_chunk(session, batch_rows, now)
        report.rows_inserted += inserted
        report.rows_updated += updated
        batch_rows.clear()

    await session.commit()
    return report
