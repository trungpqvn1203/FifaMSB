"""Loader module: batch upsert into seasons, players, and player_seasons."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.importer.transform import ValidatedPlayerRow
from app.player.domain import Player, PlayerSeason, Season


async def load_chunk(
    session: AsyncSession,
    rows: list[ValidatedPlayerRow],
    now: datetime,
) -> tuple[int, int]:
    """Batch upsert validated player rows.

    Returns:
        (rows_inserted, rows_updated)
    """
    if not rows:
        return 0, 0

    # 1. Ensure all seasons exist (auto-create unknown season_codes)
    unique_season_codes = {r.season_code for r in rows}
    existing_seasons_stmt = select(Season).where(Season.code.in_(unique_season_codes))
    existing_seasons_res = await session.execute(existing_seasons_stmt)
    season_map: dict[str, uuid.UUID] = {s.code: s.id for s in existing_seasons_res.scalars().all()}

    # Insert any missing seasons
    missing_codes = unique_season_codes - set(season_map.keys())
    if missing_codes:
        new_seasons = [
            {
                "id": uuid.uuid4(),
                "code": code,
                "name": code,
                "game": "FC Online",
                "created_at": now,
            }
            for code in missing_codes
        ]
        season_insert_stmt = (
            pg_insert(Season).values(new_seasons).on_conflict_do_nothing(index_elements=["code"])
        )
        await session.execute(season_insert_stmt)
        await session.flush()

        # Re-query all required seasons to populate map
        seasons_res = await session.execute(existing_seasons_stmt)
        season_map = {s.code: s.id for s in seasons_res.scalars().all()}

    # 2. Batch upsert master Players by external_player_id
    player_records_by_ext_id = {
        r.external_player_id: {
            "id": uuid.uuid4(),
            "external_player_id": r.external_player_id,
            "name": r.name,
            "created_at": now,
        }
        for r in rows
    }
    players_values = list(player_records_by_ext_id.values())

    player_stmt = pg_insert(Player).values(players_values)
    player_stmt = player_stmt.on_conflict_do_update(
        index_elements=["external_player_id"],
        set_={"name": player_stmt.excluded.name},
    )
    await session.execute(player_stmt)
    await session.flush()

    # Query player IDs for all external_player_ids in this chunk
    players_res = await session.execute(
        select(Player.external_player_id, Player.id).where(
            Player.external_player_id.in_(player_records_by_ext_id.keys())
        )
    )
    player_id_map: dict[str, uuid.UUID] = {row[0]: row[1] for row in players_res.all()}

    # 3. Determine which PlayerSeason records currently exist vs new
    # Pairs of (player_id, season_id)
    card_tuples = [(player_id_map[r.external_player_id], season_map[r.season_code]) for r in rows]
    player_ids = [p_id for p_id, _ in card_tuples]
    existing_cards_res = await session.execute(
        select(PlayerSeason.player_id, PlayerSeason.season_id).where(
            PlayerSeason.player_id.in_(player_ids)
        )
    )
    existing_card_set: set[tuple[uuid.UUID, uuid.UUID]] = {
        (row[0], row[1]) for row in existing_cards_res.all()
    }

    inserted_count = 0
    updated_count = 0

    card_values = []
    for r in rows:
        p_id = player_id_map[r.external_player_id]
        s_id = season_map[r.season_code]
        if (p_id, s_id) in existing_card_set:
            updated_count += 1
        else:
            inserted_count += 1
            existing_card_set.add((p_id, s_id))

        card_values.append(
            {
                "id": uuid.uuid4(),
                "player_id": p_id,
                "season_id": s_id,
                "position": r.position,
                "salary": r.salary,
                "rating": r.rating,
                "image_url": r.image_url,
                "status": "ACTIVE",
            }
        )

    # Batch upsert PlayerSeason
    card_stmt = pg_insert(PlayerSeason).values(card_values)
    card_stmt = card_stmt.on_conflict_do_update(
        index_elements=["player_id", "season_id"],
        set_={
            "position": card_stmt.excluded.position,
            "salary": card_stmt.excluded.salary,
            "rating": card_stmt.excluded.rating,
            "image_url": card_stmt.excluded.image_url,
        },
    )
    await session.execute(card_stmt)
    await session.flush()

    return inserted_count, updated_count
