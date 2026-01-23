from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.face import Face
from app.models.person import Person


def match_or_create_person(db: Session, embedding: list[float]) -> UUID:
    if not embedding:
        person = Person(name=None, is_named=False)
        db.add(person)
        db.flush()
        return person.id

    distance = Face.embedding.cosine_distance(embedding).label("distance")
    candidate = (
        db.query(Face, distance)
        .filter(Face.person_id.isnot(None))
        .order_by(distance.asc())
        .limit(1)
        .first()
    )

    if candidate:
        face, best_distance = candidate
        if best_distance is not None and float(best_distance) <= settings.face_match_threshold:
            return face.person_id

    person = Person(name=None, is_named=False)
    db.add(person)
    db.flush()
    return person.id
