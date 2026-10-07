"""SQLAlchemy domain models for User, UserSession, and UserTeamHistory (auth)."""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    """System user — either ADMIN or TEAM_USER."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    # Nullable: ADMIN users have no team assignment
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    sessions: Mapped[list["UserSession"]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("username", name="uq_users_username"),
        CheckConstraint(
            "role IN ('ADMIN', 'TEAM_USER')",
            name="ck_users_role",
        ),
    )


class UserSession(Base):
    """Server-side session record for cookie-based auth.

    The HttpOnly cookie holds only the random token (this table's PK).
    The token is never derived from user data; it is purely random.
    """

    __tablename__ = "sessions"

    # Primary key is the random opaque session token (not a UUID by design —
    # stored as a long random hex string for maximum entropy)
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")


class UserTeamHistory(Base):
    """Audit log: every time a user is assigned to a team, we write one row.

    This is an append-only table — rows are never updated or deleted.
    Used to answer: "which tournaments has this user (coordinator) participated in?"
    """

    __tablename__ = "user_team_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        # SET NULL so history survives even if team is removed
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        # SET NULL so history survives even if tournament is removed
        ForeignKey("tournaments.id", ondelete="SET NULL"),
        nullable=True,
    )
    # UTC timestamp when this assignment happened
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
