from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from PIL import ExifTags, Image


EXIF_TAGS = {v: k for k, v in ExifTags.TAGS.items()}
GPS_TAGS = {v: k for k, v in ExifTags.GPSTAGS.items()}


def _ratio_to_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except Exception:
        try:
            return float(value[0]) / float(value[1])
        except Exception:
            return None


def _dms_to_decimal(dms: Any, ref: str) -> Optional[float]:
    if not dms:
        return None
    degrees = _ratio_to_float(dms[0])
    minutes = _ratio_to_float(dms[1])
    seconds = _ratio_to_float(dms[2])
    if degrees is None or minutes is None or seconds is None:
        return None
    decimal = degrees + minutes / 60.0 + seconds / 3600.0
    if ref in ("S", "W"):
        decimal = -decimal
    return decimal


def _parse_exif_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S")
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def extract_exif(path: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    raw_exif: Dict[str, Any] = {}
    parsed: Dict[str, Any] = {}

    try:
        with Image.open(path) as img:
            exif = img.getexif()
            if not exif:
                return raw_exif, parsed
            for tag_id, value in exif.items():
                tag = ExifTags.TAGS.get(tag_id, str(tag_id))
                raw_exif[tag] = _safe_exif_value(value)

            dt_value = exif.get(EXIF_TAGS.get("DateTimeOriginal")) or exif.get(EXIF_TAGS.get("DateTime"))
            captured_at = _parse_exif_datetime(dt_value)
            if captured_at:
                parsed["captured_at"] = captured_at

            parsed["camera_make"] = exif.get(EXIF_TAGS.get("Make"))
            parsed["camera_model"] = exif.get(EXIF_TAGS.get("Model"))
            parsed["orientation"] = exif.get(EXIF_TAGS.get("Orientation"))

            gps_info = exif.get(EXIF_TAGS.get("GPSInfo"))
            if gps_info:
                gps_data = {ExifTags.GPSTAGS.get(k, str(k)): v for k, v in gps_info.items()}
                lat = _dms_to_decimal(gps_data.get("GPSLatitude"), gps_data.get("GPSLatitudeRef", "N"))
                lon = _dms_to_decimal(gps_data.get("GPSLongitude"), gps_data.get("GPSLongitudeRef", "E"))
                alt = _ratio_to_float(gps_data.get("GPSAltitude"))
                if lat is not None and lon is not None:
                    parsed["gps_lat"] = lat
                    parsed["gps_lon"] = lon
                    parsed["has_gps"] = True
                if alt is not None:
                    parsed["gps_altitude"] = alt
    except Exception:
        return raw_exif, parsed

    return raw_exif, parsed


def _safe_exif_value(value: Any) -> Any:
    try:
        if isinstance(value, bytes):
            return value.decode(errors="ignore")
        if isinstance(value, (list, tuple)):
            return [_safe_exif_value(v) for v in value]
        return value
    except Exception:
        return str(value)
