from datetime import datetime
from typing import Optional


def infer_season(captured_at: Optional[datetime], lat: Optional[float]) -> Optional[str]:
    if not captured_at:
        return None
    month = captured_at.month
    season = _season_for_month(month)
    if lat is not None and lat < 0:
        season = _invert_season(season)
    return season


def _season_for_month(month: int) -> str:
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    return "fall"


def _invert_season(season: str) -> str:
    mapping = {"winter": "summer", "summer": "winter", "spring": "fall", "fall": "spring"}
    return mapping.get(season, season)
