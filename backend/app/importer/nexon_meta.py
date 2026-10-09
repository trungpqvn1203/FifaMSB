"""Metadata loader and search utilities for FC Online Nexon data."""

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NexonSeasonInfo:
    season_id: int
    code: str
    name: str
    badge_url: str | None
    player_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "season_id": self.season_id,
            "code": self.code,
            "name": self.name,
            "badge_url": self.badge_url,
            "player_count": self.player_count,
        }


@dataclass(frozen=True)
class NexonPlayerSearchResult:
    spid: int
    name: str
    season_id: int
    season_code: str
    badge_url: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "spid": self.spid,
            "name": self.name,
            "season_id": self.season_id,
            "season_code": self.season_code,
            "badge_url": self.badge_url,
        }


def format_player_name(raw_name: str) -> str:
    """Format player name to Title Case if all lower or all upper case."""
    name = raw_name.strip()
    if not name:
        return name
    if name.islower() or name.isupper():
        return name.title()
    return name


def _find_data_file(filename: str) -> Path | None:
    """Find data file in candidate directories."""
    candidates = [
        Path("/app/data") / filename,
        Path("data") / filename,
        Path("backend/data") / filename,
        Path(__file__).resolve().parent.parent.parent / "data" / filename,
        Path(__file__).resolve().parent.parent.parent.parent / "data" / filename,
    ]
    for p in candidates:
        if p.is_file():
            return p
    return None


class NexonMetadataRegistry:
    """In-memory cache for Nexon seasons and English player names."""

    _instance: "NexonMetadataRegistry | None" = None

    def __init__(self) -> None:
        self._seasons: dict[int, dict[str, Any]] = {}
        self._players: list[dict[str, Any]] = []
        self._player_map: dict[int, str] = {}
        self._season_spids: dict[int, list[int]] = {}
        self._initialized = False

    @classmethod
    def get_instance(cls) -> "NexonMetadataRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self) -> None:
        """Load JSON metadata files if not already loaded."""
        if self._initialized:
            return

        # 1. Load seasons
        season_file = _find_data_file("seasonid.json")
        if season_file:
            try:
                with open(season_file, encoding="utf-8") as f:
                    raw_seasons = json.load(f)
                for s in raw_seasons:
                    sid = s.get("seasonId")
                    if sid is not None:
                        c_name = s.get("className", "")
                        short_code = (
                            c_name.split("(")[0].strip() if "(" in c_name else c_name.strip()
                        )
                        full_name = c_name.split("(")[1].rstrip(")") if "(" in c_name else c_name
                        self._seasons[int(sid)] = {
                            "season_id": int(sid),
                            "code": short_code.upper(),
                            "name": full_name.strip(),
                            "badge_url": s.get("seasonImg"),
                        }
            except Exception as exc:
                logger.warning("Failed to load seasonid.json: %s", exc)

        # 2. Load English player names
        spid_file = _find_data_file("spid_english.json")
        if spid_file:
            try:
                with open(spid_file, encoding="utf-8") as f:
                    raw_players = json.load(f)
                for p in raw_players:
                    spid = p.get("id")
                    name = p.get("name")
                    if spid is not None and name:
                        formatted_name = format_player_name(name)
                        self._players.append({"id": int(spid), "name": formatted_name})
                        self._player_map[int(spid)] = formatted_name
                        sid = int(spid) // 1_000_000
                        if sid not in self._season_spids:
                            self._season_spids[sid] = []
                        self._season_spids[sid].append(int(spid))
            except Exception as exc:
                logger.warning("Failed to load spid_english.json: %s", exc)

        self._initialized = True

    def get_english_name(self, spid: int) -> str | None:
        self.initialize()
        return self._player_map.get(spid)

    def get_all_seasons(self) -> list[NexonSeasonInfo]:
        """Return all seasons with player counts, sorted by player count descending."""
        self.initialize()
        result: list[NexonSeasonInfo] = []
        for sid, s in self._seasons.items():
            count = len(self._season_spids.get(sid, []))
            if count > 0:  # Only include seasons that have players
                result.append(
                    NexonSeasonInfo(
                        season_id=sid,
                        code=s["code"],
                        name=s["name"],
                        badge_url=s["badge_url"],
                        player_count=count,
                    )
                )
        # Sort by player count descending, then code
        result.sort(key=lambda x: (-x.player_count, x.code))
        return result

    def get_spids_for_season(self, season_id: int, limit: int | None = None) -> list[int]:
        """Return list of SPIDs for a given season ID."""
        self.initialize()
        spids = self._season_spids.get(season_id, [])
        if limit is not None and limit > 0:
            return spids[:limit]
        return list(spids)

    def search_players(self, query: str, limit: int = 30) -> list[NexonPlayerSearchResult]:
        """Search players by English name case-insensitively."""
        self.initialize()
        q = query.strip().lower()
        if not q:
            return []

        results: list[NexonPlayerSearchResult] = []
        for p in self._players:
            if q in p["name"].lower():
                spid = p["id"]
                sid = spid // 1_000_000
                s_info = self._seasons.get(sid, {})
                results.append(
                    NexonPlayerSearchResult(
                        spid=spid,
                        name=p["name"],
                        season_id=sid,
                        season_code=s_info.get("code", f"S{sid}"),
                        badge_url=s_info.get("badge_url"),
                    )
                )
                if len(results) >= limit:
                    break

        return results
