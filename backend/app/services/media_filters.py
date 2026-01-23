from __future__ import annotations

from typing import Any, Dict, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Query

from app.models.face import Face
from app.models.media import Media
from app.models.person import Person
from app.services.search import parse_date, parse_search


def apply_media_filters(query: Query, filters: Dict[str, Any]) -> Tuple[Query, bool]:
    joined = False

    person_ids = filters.get("person_ids") or []
    if isinstance(person_ids, str):
        person_ids = [pid.strip() for pid in person_ids.split(",") if pid.strip()]
    if person_ids:
        query = query.join(Face, Face.media_id == Media.id).filter(Face.person_id.in_(person_ids))
        joined = True

    season = filters.get("season")
    if season:
        query = query.filter(Media.season == str(season).lower())

    media_type = filters.get("media_type")
    if media_type:
        query = query.filter(Media.media_type == str(media_type).lower())

    camera_make = filters.get("camera_make")
    if camera_make:
        query = query.filter(Media.camera_make.ilike(f"%{camera_make}%"))

    camera_model = filters.get("camera_model")
    if camera_model:
        query = query.filter(Media.camera_model.ilike(f"%{camera_model}%"))

    has_faces = filters.get("has_faces")
    if has_faces is True or str(has_faces).lower() == "true":
        query = query.filter(Media.face_count > 0)
    if has_faces is False or str(has_faces).lower() == "false":
        query = query.filter(Media.face_count == 0)

    date_from = filters.get("date_from")
    if date_from:
        parsed = parse_date(str(date_from))
        if parsed:
            query = query.filter(Media.captured_at >= parsed)

    date_to = filters.get("date_to")
    if date_to:
        parsed = parse_date(str(date_to), end_of_day=True)
        if parsed:
            query = query.filter(Media.captured_at <= parsed)

    q = filters.get("q")
    tokens = parse_search(q)
    if tokens.season:
        query = query.filter(Media.season == tokens.season)
    if tokens.media_type:
        query = query.filter(Media.media_type == tokens.media_type)
    if tokens.camera_text:
        query = query.filter(
            or_(
                Media.camera_make.ilike(f"%{tokens.camera_text}%"),
                Media.camera_model.ilike(f"%{tokens.camera_text}%"),
            )
        )
    if tokens.has_faces is True:
        query = query.filter(Media.face_count > 0)
    if tokens.has_faces is False:
        query = query.filter(Media.face_count == 0)
    if tokens.has_gps is True:
        query = query.filter(Media.has_gps.is_(True))
    if tokens.has_gps is False:
        query = query.filter(Media.has_gps.is_(False))
    if tokens.date_from:
        query = query.filter(Media.captured_at >= tokens.date_from)
    if tokens.date_to:
        query = query.filter(Media.captured_at <= tokens.date_to)
    if tokens.location_text:
        query = query.filter(Media.location_text.ilike(f"%{tokens.location_text}%"))
    if tokens.free_text:
        for term in tokens.free_text:
            query = query.filter(
                or_(
                    Media.location_text.ilike(f"%{term}%"),
                    Media.camera_make.ilike(f"%{term}%"),
                    Media.camera_model.ilike(f"%{term}%"),
                    Media.original_filename.ilike(f"%{term}%"),
                )
            )
    if tokens.person_names:
        query = (
            query.join(Face, Face.media_id == Media.id)
            .join(Person, Person.id == Face.person_id)
            .filter(or_(*[Person.name.ilike(f"%{name}%") for name in tokens.person_names]))
        )
        joined = True

    return query, joined
