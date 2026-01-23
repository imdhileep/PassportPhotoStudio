from typing import Optional

from app.core.config import settings


def format_location(lat: float, lon: float) -> str:
    if settings.location_label_style == "cardinal":
        return _cardinal(lat, lon)
    return f"{lat:.5f}, {lon:.5f}"


def _cardinal(lat: float, lon: float) -> str:
    lat_dir = "N" if lat >= 0 else "S"
    lon_dir = "E" if lon >= 0 else "W"
    return f"{abs(lat):.4f}{lat_dir}, {abs(lon):.4f}{lon_dir}"


def reverse_geocode_optional(lat: float, lon: float) -> Optional[str]:
    if not settings.reverse_geocode_enabled:
        return None
    return format_location(lat, lon)
