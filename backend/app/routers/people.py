from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.face import Face
from app.models.person import Person
from app.schemas.people import PersonMerge, PersonOut, PersonUpdate
from app.services.deps import get_current_user

router = APIRouter(prefix="/people", tags=["people"])


@router.get("", response_model=list[PersonOut])
def list_people(db: Session = Depends(get_db)):
    rows = (
        db.query(Person, func.count(Face.id).label("face_count"))
        .outerjoin(Face, Face.person_id == Person.id)
        .group_by(Person.id)
        .order_by(func.count(Face.id).desc())
        .all()
    )
    return [
        PersonOut(
            id=person.id,
            name=person.name,
            is_named=person.is_named,
            face_count=int(face_count),
        )
        for person, face_count in rows
    ]


@router.patch("/{person_id}", response_model=PersonOut)
def rename_person(
    person_id: UUID,
    payload: PersonUpdate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    person.name = payload.name
    person.is_named = True
    db.commit()
    face_count = db.query(func.count(Face.id)).filter(Face.person_id == person.id).scalar() or 0
    return PersonOut(id=person.id, name=person.name, is_named=person.is_named, face_count=int(face_count))


@router.post("/merge", response_model=PersonOut)
def merge_people(
    payload: PersonMerge,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    target = db.get(Person, payload.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target person not found")
    if not payload.source_ids:
        raise HTTPException(status_code=400, detail="No source_ids provided")
    if target.id in payload.source_ids:
        raise HTTPException(status_code=400, detail="target_id cannot be in source_ids")

    db.query(Face).filter(Face.person_id.in_(payload.source_ids)).update(
        {"person_id": target.id}, synchronize_session=False
    )
    db.query(Person).filter(Person.id.in_(payload.source_ids)).delete(synchronize_session=False)
    db.commit()

    face_count = db.query(func.count(Face.id)).filter(Face.person_id == target.id).scalar() or 0
    return PersonOut(id=target.id, name=target.name, is_named=target.is_named, face_count=int(face_count))
