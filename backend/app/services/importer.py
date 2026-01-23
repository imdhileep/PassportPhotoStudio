import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.media import Media
from app.services.storage import compute_and_store_path, derive_media_type, ensure_storage_dirs
from app.tasks.media import process_media

logger = logging.getLogger(__name__)


def iter_import_files(import_root: Path) -> Iterable[Path]:
    if not import_root.exists():
        import_root.mkdir(parents=True, exist_ok=True)
    for path in sorted(import_root.iterdir()):
        if path.is_file():
            yield path


def scan_import_folder() -> int:
    ensure_storage_dirs()
    import_root = Path(settings.import_root)
    imported = 0

    for source_path in iter_import_files(import_root):
        stat = source_path.stat()
        sha256, size, storage_path, _existed = compute_and_store_path(source_path)

        mime_type = mimetypes.guess_type(source_path.name)[0]
        media_type = derive_media_type(mime_type, source_path.name)
        captured_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)

        db = SessionLocal()
        try:
            existing = db.query(Media).filter(Media.sha256 == sha256).first()
            if existing:
                continue

            media = Media(
                sha256=sha256,
                original_filename=source_path.name,
                storage_path=storage_path,
                size_bytes=size,
                mime_type=mime_type,
                media_type=media_type,
                captured_at=captured_at,
            )
            db.add(media)
            db.commit()
            db.refresh(media)
            process_media.delay(str(media.id))
            imported += 1
        except IntegrityError:
            db.rollback()
        finally:
            db.close()

    return imported
