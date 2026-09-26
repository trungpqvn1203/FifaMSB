"""Root conftest.py — only fixtures that apply to ALL tests.

Unit tests must not require Docker or a database.
Integration fixtures are in tests/integration/conftest.py.
"""

import pytest


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    """Use asyncio backend for pytest-asyncio."""
    return "asyncio"
