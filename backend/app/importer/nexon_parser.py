"""Parser for Nexon FC Online DataCenter player ability responses."""

import re

from app.importer.transform import ValidatedPlayerRow
from app.player.position import is_valid_position, normalize_position


class NexonParsedCard:
    """Detailed parsed representation of a player card from Nexon FC Online."""

    def __init__(
        self,
        spid: int,
        pid: int,
        name: str,
        season_code: str,
        position: str,
        rating: int,
        salary: int,
        image_url: str | None,
        pace: int | None = None,
        shooting: int | None = None,
        passing: int | None = None,
        dribbling: int | None = None,
        defending: int | None = None,
        physical: int | None = None,
        height_cm: int | None = None,
        weight_kg: int | None = None,
        preferred_foot: str | None = None,
        skill_stars: int | None = None,
        traits: list[str] | None = None,
        detailed_stats: dict[str, int] | None = None,
    ) -> None:
        self.spid = spid
        self.pid = pid
        self.name = name
        self.season_code = season_code
        self.position = position
        self.rating = rating
        self.salary = salary
        self.image_url = image_url
        self.pace = pace
        self.shooting = shooting
        self.passing = passing
        self.dribbling = dribbling
        self.defending = defending
        self.physical = physical
        self.height_cm = height_cm
        self.weight_kg = weight_kg
        self.preferred_foot = preferred_foot
        self.skill_stars = skill_stars
        self.traits = traits or []
        self.detailed_stats = detailed_stats or {}

    def to_validated_row(self) -> ValidatedPlayerRow:
        """Convert to the standard ValidatedPlayerRow used by the importer."""
        return ValidatedPlayerRow(
            external_player_id=f"p_{self.pid}",
            name=self.name,
            season_code=self.season_code,
            position=self.position,
            salary=self.salary,
            rating=self.rating,
            image_url=self.image_url,
            pace=self.pace,
            shooting=self.shooting,
            passing=self.passing,
            dribbling=self.dribbling,
            defending=self.defending,
            physical=self.physical,
        )


def _clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def parse_player_ability_html(
    spid: int,
    html: str,
    fallback_name: str | None = None,
    fallback_season_code: str | None = None,
) -> NexonParsedCard | None:
    """Parse player card HTML from POST /datacenter/PlayerAbility.

    Returns:
        NexonParsedCard if valid, or None if the HTML could not be parsed.
    """
    if not html or not html.strip():
        return None

    pid = spid % 1_000_000

    # 1. Player Name
    name_match = re.search(r'<div class="name">([^<]+)</div>', html)
    name = _clean_text(name_match.group(1)) if name_match else ""
    if not name and fallback_name:
        name = _clean_text(fallback_name)
    if not name:
        return None

    # 2. Season Code
    season_code = ""
    # Try finding in season img url
    season_img_match = re.search(
        r'<div class="season">\s*<img[^>]+src=["\'][^"\']*/([A-Za-z0-9_-]+)\.png',
        html,
    )
    if season_img_match:
        season_code = season_img_match.group(1).upper()
    if not season_code:
        # Try finding in script thumb_currrent_season
        script_season_match = re.search(r'thumb_currrent_season\s*=\s*["\']([^"\']+)["\']', html)
        if script_season_match:
            season_code = script_season_match.group(1).upper()
    if not season_code and fallback_season_code:
        season_code = fallback_season_code.upper()
    if not season_code:
        # Fallback to season ID prefix
        season_id = spid // 1_000_000
        season_code = f"SEASON_{season_id}"

    # 3. Position
    raw_pos = ""
    pos_match = re.search(r'<div class="position">\s*([A-Za-z]+)\s*</div>', html)
    if pos_match:
        raw_pos = pos_match.group(1).strip()
    else:
        # Alternative in info_ab or info_middle
        alt_pos_match = re.search(
            r'<span class="position[^"]*">\s*<span class="txt">([A-Za-z]+)</span>',
            html,
        )
        if alt_pos_match:
            raw_pos = alt_pos_match.group(1).strip()

    if not raw_pos:
        return None

    norm_pos = normalize_position(raw_pos)
    if not is_valid_position(norm_pos):
        return None

    # 4. Rating (OVR)
    rating: int | None = None
    ovr_match = re.search(r'<div class="ovr value">\s*(\d+)\s*</div>', html)
    if ovr_match:
        rating = int(ovr_match.group(1))
    else:
        alt_ovr_match = re.search(r'<span class="skillData_\d+ value">\s*(\d+)\s*</span>', html)
        if alt_ovr_match:
            rating = int(alt_ovr_match.group(1))

    if rating is None:
        return None

    # 5. Salary (pay)
    salary: int | None = None
    pay_side_match = re.search(r'<div class="pay_side">\s*(\d+)\s*</div>', html)
    if pay_side_match:
        salary = int(pay_side_match.group(1))
    else:
        pay_match = re.search(r'<div class="pay">.*?<span>(\d+)</span>', html, re.DOTALL)
        if pay_match:
            salary = int(pay_match.group(1))

    if salary is None or salary < 1:
        return None

    # 6. Image URL
    image_url: str | None = None
    cust_img_match = re.search(r'name="hidPlayerCustImg"\s+value="([^"]+)"', html)
    if cust_img_match and cust_img_match.group(1).strip():
        image_url = cust_img_match.group(1).strip()
    else:
        # High-res action image or standard action image
        high_img_match = re.search(r'<div class="img action">\s*<img[^>]+src="([^"?]+)', html)
        if high_img_match and high_img_match.group(1).strip():
            image_url = high_img_match.group(1).strip()
        else:
            image_url = f"https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p{spid}.png"

    # 7. Stats
    stat_blocks = re.findall(
        r'<div class="txt">([^<]+)</div>\s*<div class="value[^"]*">\s*(\d+)',
        html,
    )
    detailed_stats: dict[str, int] = {}
    for txt, val in stat_blocks:
        detailed_stats[txt.strip()] = int(val.strip())

    # Map core stats from Korean labels
    pace = detailed_stats.get("스피드")
    shooting = detailed_stats.get("슛")
    passing = detailed_stats.get("패스")
    dribbling = detailed_stats.get("드리블")
    defending = detailed_stats.get("수비")
    physical = detailed_stats.get("피지컬")

    # 8. Physical / Bio details
    height_cm: int | None = None
    h_match = re.search(r'<span class="etc height">(\d+)cm</span>', html)
    if h_match:
        height_cm = int(h_match.group(1))

    weight_kg: int | None = None
    w_match = re.search(r'<span class="etc weight">(\d+)kg</span>', html)
    if w_match:
        weight_kg = int(w_match.group(1))

    preferred_foot: str | None = None
    foot_match = re.search(
        r'<span class="etc foot">\s*L(\d+)\s*[–-]\s*<strong>R(\d+)</strong>',
        html,
    )
    if foot_match:
        preferred_foot = f"L{foot_match.group(1)}-R{foot_match.group(2)}"

    skill_stars: int | None = None
    skill_match = re.search(r'<span class="etc skill">\s*<span>(★+)</span>', html)
    if skill_match:
        skill_stars = len(skill_match.group(1))

    # Traits
    raw_traits = re.findall(r'<span class="desc">([^<]+)</span>', html)
    traits = [t.strip() for t in raw_traits if t.strip()]

    return NexonParsedCard(
        spid=spid,
        pid=pid,
        name=name,
        season_code=season_code,
        position=norm_pos,
        rating=rating,
        salary=salary,
        image_url=image_url,
        pace=pace,
        shooting=shooting,
        passing=passing,
        dribbling=dribbling,
        defending=defending,
        physical=physical,
        height_cm=height_cm,
        weight_kg=weight_kg,
        preferred_foot=preferred_foot,
        skill_stars=skill_stars,
        traits=traits,
        detailed_stats=detailed_stats,
    )
