"""Transformer module: pure functions validating and standardizing player rows."""

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.player.position import is_valid_position, normalize_position


class ValidatedPlayerRow(BaseModel):
    """Pydantic model representing a cleaned, valid player season card row."""

    external_player_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    season_code: str = Field(min_length=1)
    position: str = Field(min_length=1)
    salary: int = Field(ge=1)
    rating: int | None = None
    image_url: str | None = None

    @field_validator("external_player_id", "name", "season_code", mode="before")
    @classmethod
    def clean_strings(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip()

    @field_validator("season_code")
    @classmethod
    def normalize_season(cls, v: str) -> str:
        return v.upper()

    @field_validator("position")
    @classmethod
    def check_position(cls, v: Any) -> str:
        if not v:
            raise ValueError("Position is required")
        pos = normalize_position(str(v))
        if not is_valid_position(pos):
            raise ValueError(f"Unknown position '{v}'")
        return pos

    @field_validator("salary", mode="before")
    @classmethod
    def parse_salary(cls, v: Any) -> int:
        try:
            val = int(v)
            if val < 1:
                raise ValueError("Salary must be >= 1")
            return val
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Invalid salary value: {v}") from exc

    @field_validator("rating", mode="before")
    @classmethod
    def parse_rating(cls, v: Any) -> int | None:
        if v is None or str(v).strip() == "":
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None

    @field_validator("image_url", mode="before")
    @classmethod
    def clean_image_url(cls, v: Any) -> str | None:
        if v is None or str(v).strip() == "":
            return None
        return str(v).strip()


def transform_row(
    raw_dict: dict[str, Any],
) -> tuple[ValidatedPlayerRow | None, str | None]:
    """Transform and validate a single dictionary row.

    Returns:
        (ValidatedPlayerRow, None) on success, or
        (None, reason) when skipped.
    """
    # Quick check for external_player_id
    ext_id = raw_dict.get("external_player_id") or raw_dict.get("externalPlayerId")
    if not ext_id or not str(ext_id).strip():
        name = raw_dict.get("name", "unknown")
        return None, f"Skipped row (name='{name}'): external_player_id is missing or empty"

    try:
        row = ValidatedPlayerRow(
            external_player_id=str(ext_id),
            name=raw_dict.get("name", ""),
            season_code=raw_dict.get("season_code") or raw_dict.get("seasonCode", ""),
            position=raw_dict.get("position", ""),
            salary=raw_dict.get("salary", 0),
            rating=raw_dict.get("rating"),
            image_url=raw_dict.get("image_url") or raw_dict.get("imageUrl"),
        )
        return row, None
    except Exception as exc:
        name = raw_dict.get("name", "unknown")
        return None, f"Skipped row (id='{ext_id}', name='{name}'): {exc}"


def transform_chunk(
    records: list[dict[str, Any]],
) -> tuple[list[ValidatedPlayerRow], list[str]]:
    """Transform a list of raw row records.

    Returns:
        (list of valid rows, list of skip reasons)
    """
    valid_rows: list[ValidatedPlayerRow] = []
    errors: list[str] = []

    for record in records:
        valid_row, error = transform_row(record)
        if valid_row is not None:
            valid_rows.append(valid_row)
        elif error:
            errors.append(error)

    return valid_rows, errors
