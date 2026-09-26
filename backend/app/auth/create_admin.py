"""CLI command to create the initial ADMIN user.

Usage:
    uv run python -m app.auth.create_admin [--username USERNAME] [--password PASSWORD]
"""

import argparse
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.tournament.domain  # noqa: F401
from app.auth.domain import User
from app.auth.service import hash_password
from app.db import AsyncSessionFactory, engine


async def create_admin(
    username: str,
    password: str,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
) -> None:
    """Create or verify an admin user in the database."""
    factory = session_factory or AsyncSessionFactory
    async with factory() as session:
        stmt = select(User).where(User.username == username)
        result = await session.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user is not None:
            if existing_user.role == "ADMIN":
                print(f"Admin user '{username}' already exists. Updating password...")
                existing_user.password_hash = hash_password(password)
                await session.commit()
                print(f"Password updated successfully for admin '{username}'.")
                return
            else:
                print(
                    f"Error: User '{username}' exists but has role '{existing_user.role}'. "
                    "Cannot convert to ADMIN automatically.",
                    file=sys.stderr,
                )
                sys.exit(1)

        hashed = hash_password(password)
        admin = User(
            username=username,
            password_hash=hashed,
            role="ADMIN",
            team_id=None,
        )
        session.add(admin)
        await session.commit()
        print(f"Admin user '{username}' created successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the initial admin user.")
    parser.add_argument(
        "--username",
        default="admin",
        help="Username for the admin user (default: admin)",
    )
    parser.add_argument(
        "--password",
        default="admin123",
        help="Password for the admin user (default: admin123)",
    )
    args = parser.parse_args()

    try:
        asyncio.run(create_admin(args.username, args.password))
    finally:
        asyncio.run(engine.dispose())


if __name__ == "__main__":
    main()
