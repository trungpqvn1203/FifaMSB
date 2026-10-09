from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.common.clock import FakeClock
from app.common.errors import PoolLocked
from app.importer.nexon_client import NexonClient
from app.importer.nexon_parser import NexonParsedCard, parse_player_ability_html
from app.importer.nexon_pipeline import run_nexon_sync_pipeline
from app.importer.transform import ValidatedPlayerRow
from app.player.pool_lock import DefaultPoolLockPolicy

# Sample HTML snippets for testing
SAMPLE_RONALDO_HTML = """
<input type="hidden" name="hidPlayerCustImg"
       value="https://fco.dn.nexoncdn.co.kr/live/.../playersAction/p877020801.png" />
<div class="content data_detail">
    <div class="ovr value">124</div>
    <div class="position">ST</div>
    <div class="pay_side">34</div>
    <div class="name">크리스티아누 호날두</div>
    <div class="season">
        <img src="https://ssl.nexon.com/.../season/UC.png" alt="" />
    </div>
    <div class="info_line info_etc">
        <span class="etc height">187cm</span>
        <span class="etc weight">85kg</span>
        <span class="etc foot">L5 – <strong>R5</strong></span>
        <span class="etc skill"><span>★★★★★</span>☆</span>
    </div>
    <div class="txt">스피드</div><div class="value">127</div>
    <div class="txt">슛</div><div class="value">127</div>
    <div class="txt">패스</div><div class="value">112</div>
    <div class="txt">드리블</div><div class="value">127</div>
    <div class="txt">수비</div><div class="value">77</div>
    <div class="txt">피지컬</div><div class="value">117</div>
    <span class="desc">파워 헤더</span>
    <span class="desc">스피드 드리블러</span>
</div>
"""

SAMPLE_GK_HTML = """
<div class="content data_detail">
    <div class="ovr value">124</div>
    <div class="position">GK</div>
    <div class="pay_side">28</div>
    <div class="name">올리버 칸</div>
    <div class="season">
        <img src="https://ssl.nexon.com/.../season/icontm.png" alt="" />
    </div>
    <div class="info_line info_etc">
        <span class="etc height">188cm</span>
        <span class="etc weight">91kg</span>
        <span class="etc foot">L3 – <strong>R5</strong></span>
    </div>
    <div class="txt">GK 다이빙</div><div class="value">129</div>
    <div class="txt">GK 핸들링</div><div class="value">122</div>
    <div class="txt">GK 킥</div><div class="value">106</div>
    <div class="txt">GK 반응속도</div><div class="value">130</div>
    <div class="txt">GK 위치 선정</div><div class="value">124</div>
</div>
"""

SAMPLE_MALFORMED_HTML = """
<div class="content data_detail">
    <div class="name">Broken Card</div>
</div>
"""


@pytest.mark.unit
def test_parse_player_ability_fw() -> None:
    """Parse forward player card (Cristiano Ronaldo)."""
    spid = 877020801
    card = parse_player_ability_html(spid=spid, html=SAMPLE_RONALDO_HTML)

    assert card is not None
    assert isinstance(card, NexonParsedCard)
    assert card.spid == 877020801
    assert card.pid == 20801
    assert card.name == "크리스티아누 호날두"
    assert card.season_code == "UC"
    assert card.position == "ST"
    assert card.rating == 124
    assert card.salary == 34
    assert card.pace == 127
    assert card.shooting == 127
    assert card.passing == 112
    assert card.dribbling == 127
    assert card.defending == 77
    assert card.physical == 117
    assert card.height_cm == 187
    assert card.weight_kg == 85
    assert card.preferred_foot == "L5-R5"
    assert card.skill_stars == 5
    assert "파워 헤더" in card.traits
    assert "스피드 드리블러" in card.traits

    # Verify conversion to ValidatedPlayerRow
    row = card.to_validated_row()
    assert isinstance(row, ValidatedPlayerRow)
    assert row.external_player_id == "p_20801"
    assert row.name == "크리스티아누 호날두"
    assert row.season_code == "UC"
    assert row.position == "ST"
    assert row.salary == 34
    assert row.rating == 124
    assert row.pace == 127
    assert row.shooting == 127


@pytest.mark.unit
def test_parse_player_ability_gk() -> None:
    """Parse goalkeeper card (Oliver Kahn)."""
    spid = 100000488
    card = parse_player_ability_html(spid=spid, html=SAMPLE_GK_HTML)

    assert card is not None
    assert card.spid == 100000488
    assert card.pid == 488
    assert card.name == "올리버 칸"
    assert card.season_code == "ICONTM"
    assert card.position == "GK"
    assert card.rating == 124
    assert card.salary == 28
    assert card.height_cm == 188
    assert card.weight_kg == 91
    assert card.detailed_stats.get("GK 다이빙") == 129
    assert card.detailed_stats.get("GK 반응속도") == 130

    row = card.to_validated_row()
    assert row.external_player_id == "p_488"
    assert row.position == "GK"
    assert row.salary == 28


@pytest.mark.unit
def test_parse_player_ability_malformed_returns_none() -> None:
    """Malformed or incomplete HTML safely returns None without exception."""
    card = parse_player_ability_html(spid=123, html=SAMPLE_MALFORMED_HTML)
    assert card is None

    empty_card = parse_player_ability_html(spid=123, html="")
    assert empty_card is None


@pytest.mark.unit
def test_parse_player_ability_fallback_name_and_season() -> None:
    """Fallback name and season code are used if not present in HTML."""
    html_without_name = """
    <div class="ovr value">105</div>
    <div class="position">CAM</div>
    <div class="pay_side">25</div>
    """
    card = parse_player_ability_html(
        spid=101000250,
        html=html_without_name,
        fallback_name="David Beckham",
        fallback_season_code="ICON",
    )
    assert card is not None
    assert card.name == "David Beckham"
    assert card.season_code == "ICON"
    assert card.position == "CAM"
    assert card.rating == 105
    assert card.salary == 25


@pytest.mark.unit
async def test_nexon_client_fetch_ability_success() -> None:
    """NexonClient successfully retrieves HTML with expected headers."""
    mock_transport = httpx.MockTransport(
        lambda request: httpx.Response(200, text=SAMPLE_RONALDO_HTML)
    )
    async with httpx.AsyncClient(transport=mock_transport) as http_client:
        client = NexonClient(client=http_client)
        result = await client.fetch_player_ability_html(877020801)
        assert result is not None
        assert "크리스티아누 호날두" in result


@pytest.mark.unit
async def test_nexon_client_fetch_ability_retries_transient_error() -> None:
    """NexonClient retries on transient 500 error and recovers."""
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(500, text="Internal Server Error")
        return httpx.Response(200, text=SAMPLE_RONALDO_HTML)

    mock_transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=mock_transport) as http_client:
        client = NexonClient(client=http_client, max_retries=2, backoff_factor=0.01)
        result = await client.fetch_player_ability_html(877020801)
        assert result is not None
        assert calls == 2


@pytest.mark.unit
async def test_run_nexon_sync_pipeline_success() -> None:
    """run_nexon_sync_pipeline processes SPIDs and returns report."""
    mock_session = AsyncMock()
    mock_policy = DefaultPoolLockPolicy()
    clock = FakeClock(datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC))

    mock_client = AsyncMock(spec=NexonClient)
    mock_client.fetch_season_metadata = AsyncMock(return_value=[])
    mock_client.fetch_player_ability_html = AsyncMock(return_value=SAMPLE_RONALDO_HTML)

    with patch("app.importer.nexon_pipeline.load_chunk", new=AsyncMock(return_value=(1, 0))):
        report = await run_nexon_sync_pipeline(
            session=mock_session,
            clock=clock,
            pool_lock_policy=mock_policy,
            spids=[877020801],
            client=mock_client,
        )
        assert report.rows_read == 1
        assert report.rows_inserted == 1
        assert report.rows_skipped == 0
        assert mock_session.commit.called


@pytest.mark.unit
async def test_run_nexon_sync_pipeline_pool_locked_raises() -> None:
    """run_nexon_sync_pipeline raises PoolLocked if draft active."""
    mock_session = AsyncMock()
    clock = FakeClock(datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC))

    mock_policy = AsyncMock()
    mock_policy.is_locked = AsyncMock(return_value=True)

    with pytest.raises(PoolLocked):
        await run_nexon_sync_pipeline(
            session=mock_session,
            clock=clock,
            pool_lock_policy=mock_policy,
            spids=[877020801],
        )


@pytest.mark.unit
def test_format_player_name() -> None:
    from app.importer.nexon_meta import format_player_name

    assert format_player_name("david beckham") == "David Beckham"
    assert format_player_name("ALAN SHEARER") == "Alan Shearer"
    assert format_player_name("Cristiano Ronaldo") == "Cristiano Ronaldo"
    assert format_player_name("De Bruyne") == "De Bruyne"
    assert format_player_name("") == ""


@pytest.mark.unit
def test_nexon_metadata_registry() -> None:
    from app.importer.nexon_meta import NexonMetadataRegistry

    registry = NexonMetadataRegistry.get_instance()
    registry.initialize()

    seasons = registry.get_all_seasons()
    assert len(seasons) > 0
    # ICON TM (100) should be present
    icon_tm = next((s for s in seasons if s.season_id == 100), None)
    assert icon_tm is not None
    assert icon_tm.player_count > 0

    spids_100 = registry.get_spids_for_season(100, limit=5)
    assert len(spids_100) == 5
    assert all(s // 1_000_000 == 100 for s in spids_100)

    # Search
    search_results = registry.search_players("ronaldo", limit=10)
    assert len(search_results) > 0
    assert any("ronaldo" in r.name.lower() for r in search_results)

