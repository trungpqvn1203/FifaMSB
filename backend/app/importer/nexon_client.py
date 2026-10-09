"""Asynchronous HTTP client for Nexon FC Online Open API and DataCenter."""

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

META_BASE_URL = "https://open.api.nexon.com/static/fconline/meta"
DATACENTER_URL = "https://fconline.nexon.com/datacenter"
CDN_BASE_URL = "https://fco.dn.nexoncdn.co.kr/live/externalAssets/common"


class NexonClient:
    """Client for fetching FC Online metadata and player card stats from Nexon."""

    def __init__(
        self,
        timeout: float = 12.0,
        max_retries: int = 3,
        backoff_factor: float = 0.5,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self._custom_client = client

    def _default_headers(self) -> dict[str, str]:
        return {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "*/*",
        }

    async def _get_client(self) -> httpx.AsyncClient:
        if self._custom_client is not None:
            return self._custom_client
        return httpx.AsyncClient(
            headers=self._default_headers(),
            timeout=self.timeout,
            follow_redirects=False,
        )

    async def fetch_season_metadata(self) -> list[dict[str, Any]]:
        """Fetch all season mappings from the official static metadata endpoint."""
        url = f"{META_BASE_URL}/seasonid.json"
        client = await self._get_client()
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            data: list[dict[str, Any]] = resp.json()
            return data
        finally:
            if self._custom_client is None:
                await client.aclose()

    async def fetch_spid_metadata(self) -> list[dict[str, Any]]:
        """Fetch all SPID-to-name mappings from the official static metadata endpoint."""
        url = f"{META_BASE_URL}/spid.json"
        client = await self._get_client()
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            data: list[dict[str, Any]] = resp.json()
            return data
        finally:
            if self._custom_client is None:
                await client.aclose()

    async def fetch_player_ability_html(self, spid: int) -> str | None:
        """Fetch raw HTML containing card abilities for a given SPID.

        Retries on transient network errors or HTTP 429/5xx status codes.
        """
        url = f"{DATACENTER_URL}/PlayerAbility"
        headers = {
            **self._default_headers(),
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://fconline.nexon.com/DataCenter/PlayerStat",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        }
        data = {"spid": str(spid)}

        client = await self._get_client()
        try:
            for attempt in range(1, self.max_retries + 1):
                try:
                    resp = await client.post(url, headers=headers, data=data)
                    if resp.status_code == 200:
                        return resp.text
                    if resp.status_code in (429, 500, 502, 503, 504):
                        logger.warning(
                            "Transient HTTP %d from Nexon for spid=%d (attempt %d/%d)",
                            resp.status_code,
                            spid,
                            attempt,
                            self.max_retries,
                        )
                    else:
                        logger.warning(
                            "Unexpected HTTP %d from Nexon for spid=%d",
                            resp.status_code,
                            spid,
                        )
                        return None
                except (httpx.TransportError, httpx.TimeoutException) as exc:
                    logger.warning(
                        "Network error fetching spid=%d (attempt %d/%d): %s",
                        spid,
                        attempt,
                        self.max_retries,
                        exc,
                    )

                if attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_factor * (2 ** (attempt - 1)))

            return None
        finally:
            if self._custom_client is None:
                await client.aclose()

    @staticmethod
    def build_action_image_url(spid: int) -> str:
        """Construct the canonical CDN URL for a card's action shot."""
        return f"{CDN_BASE_URL}/playersAction/p{spid}.png"

    @staticmethod
    def build_player_portrait_url(pid: int) -> str:
        """Construct the canonical CDN URL for a base player's face avatar."""
        return f"{CDN_BASE_URL}/players/p{pid}.png"
