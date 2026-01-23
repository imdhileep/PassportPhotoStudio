from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class SearchFilters:
    person_names: list[str] = field(default_factory=list)
    season: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    location_text: Optional[str] = None
    media_type: Optional[str] = None
    camera_text: Optional[str] = None
    has_faces: Optional[bool] = None
    has_gps: Optional[bool] = None
    free_text: list[str] = field(default_factory=list)


def parse_search(q: Optional[str]) -> SearchFilters:
    if not q:
        return SearchFilters()

    filters = SearchFilters()
    tokens = q.strip().split()
    for token in tokens:
        if ":" not in token:
            filters.free_text.append(token)
            continue
        key, value = token.split(":", 1)
        key = key.lower()
        value = value.strip()
        if not value:
            continue

        if key in ("person", "people", "p"):
            parts = [part.strip() for part in value.split(",") if part.strip()]
            filters.person_names.extend(parts)
        elif key in ("season", "s"):
            filters.season = value.lower()
        elif key in ("date", "d"):
            if ".." in value:
                start, end = value.split("..", 1)
                filters.date_from = parse_date(start)
                filters.date_to = parse_date(end, end_of_day=True)
            else:
                parsed = parse_date(value)
                if parsed:
                    filters.date_from = parsed
                    filters.date_to = parse_date(value, end_of_day=True)
        elif key in ("location", "loc"):
            filters.location_text = value
        elif key in ("type", "filetype", "media"):
            filters.media_type = value.lower()
        elif key in ("camera", "device"):
            filters.camera_text = value
        elif key in ("hasfaces", "faces"):
            filters.has_faces = _parse_bool(value)
        elif key in ("hasgps", "gps"):
            filters.has_gps = _parse_bool(value)

    return filters


def parse_date(value: str, end_of_day: bool = False) -> Optional[datetime]:
    value = value.strip()
    formats = ["%Y-%m-%d", "%Y-%m", "%Y"]
    for fmt in formats:
        try:
            dt = datetime.strptime(value, fmt)
            if fmt == "%Y":
                dt = dt.replace(month=12 if end_of_day else 1, day=31 if end_of_day else 1)
            elif fmt == "%Y-%m":
                if end_of_day:
                    dt = dt.replace(day=28)
            if end_of_day:
                dt = dt.replace(hour=23, minute=59, second=59)
            return dt
        except Exception:
            continue
    return None


def _parse_bool(value: str) -> Optional[bool]:
    value = value.strip().lower()
    if value in ("true", "1", "yes", "y"):
        return True
    if value in ("false", "0", "no", "n"):
        return False
    return None
