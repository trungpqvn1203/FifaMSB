"""Position definitions and grouping for FC Online player cards.

Positions are stored as the game's original string without collapsing
(ST, CF, LW, RW, CAM, CM, CDM, LM, RM, CB, LB, RB, LWB, RWB, GK).
Position groups (FW, MF, DF, GK) are defined in this ONE place.
"""

# Map of position group chip -> set of exact game positions
POSITION_GROUPS: dict[str, set[str]] = {
    "FW": {"ST", "CF", "LW", "RW"},
    "MF": {"CDM", "CM", "CAM", "LM", "RM"},
    "DF": {"CB", "LB", "RB", "LWB", "RWB"},
    "GK": {"GK"},
}

ALL_POSITIONS: set[str] = {
    pos for group_positions in POSITION_GROUPS.values() for pos in group_positions
}


def normalize_position(pos: str) -> str:
    """Normalize position string to uppercase trimmed."""
    return pos.strip().upper()


def is_valid_position(pos: str) -> bool:
    """Check if a position string is recognized."""
    return normalize_position(pos) in ALL_POSITIONS


def get_positions_for_group(group: str) -> set[str] | None:
    """Return the set of positions for a group (FW, MF, DF, GK).

    Returns None if group is not recognized.
    """
    return POSITION_GROUPS.get(group.strip().upper())
