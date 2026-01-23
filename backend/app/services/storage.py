import hashlib
import mimetypes
import os
import re
import shutil
from pathlib import Path
from typing import Optional, Tuple

from fastapi import UploadFile
from PIL import Image

from app.core.config import settings

CHUNK_SIZE = 1024 * 1024
THUMB_SIZE = (512, 512)


def _safe_name(filename: str) -> str:
    name = Path(filename).name
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return sanitized or "file"


def _media_type(mime_type: Optional[str], filename: str) -> str:
    if mime_type and mime_type.startswith("image/"):
        return "image"
    if mime_type and mime_type.startswith("video/"):
        return "video"
    guessed, _ = mimetypes.guess_type(filename)
    if guessed and guessed.startswith("image/"):
        return "image"
    if guessed and guessed.startswith("video/"):
        return "video"
    return "other"


def ensure_storage_dirs() -> None:
    Path(settings.media_root).mkdir(parents=True, exist_ok=True)
    Path(settings.thumb_root).mkdir(parents=True, exist_ok=True)
    Path(settings.media_root, "tmp").mkdir(parents=True, exist_ok=True)


def derive_media_type(mime_type: Optional[str], filename: str) -> str:
    return _media_type(mime_type, filename)


def compute_and_store_path(source_path: Path) -> Tuple[str, int, str, bool]:
    ensure_storage_dirs()

    safe_name = _safe_name(source_path.name)
    hasher = hashlib.sha256()
    size = 0

    with source_path.open("rb") as source_file:
        while True:
            chunk = source_file.read(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            hasher.update(chunk)

    sha256 = hasher.hexdigest()
    subdir = Path(sha256[:2], sha256[2:4])
    final_dir = Path(settings.media_root, subdir)
    final_dir.mkdir(parents=True, exist_ok=True)
    final_name = f"{sha256}_{safe_name}"
    final_path = final_dir / final_name

    existed = final_path.exists()
    if existed:
        source_path.unlink(missing_ok=True)
    else:
        shutil.move(str(source_path), str(final_path))

    storage_path = str(subdir / final_name)
    return sha256, size, storage_path, existed


def compute_and_store(upload: UploadFile) -> Tuple[str, int, str]:
    ensure_storage_dirs()

    safe_name = _safe_name(upload.filename or "file")
    tmp_path = Path(settings.media_root, "tmp", f"{safe_name}.part")
    hasher = hashlib.sha256()
    size = 0

    with tmp_path.open("wb") as tmp_file:
        while True:
            chunk = upload.file.read(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            hasher.update(chunk)
            tmp_file.write(chunk)

    sha256 = hasher.hexdigest()
    subdir = Path(sha256[:2], sha256[2:4])
    final_dir = Path(settings.media_root, subdir)
    final_dir.mkdir(parents=True, exist_ok=True)
    final_name = f"{sha256}_{safe_name}"
    final_path = final_dir / final_name

    if final_path.exists():
        tmp_path.unlink(missing_ok=True)
    else:
        shutil.move(str(tmp_path), str(final_path))

    storage_path = str(subdir / final_name)
    return sha256, size, storage_path


def create_thumbnail(storage_path: str, filename: str, mime_type: Optional[str]) -> Optional[str]:
    media_kind = _media_type(mime_type, filename)
    if media_kind != "image":
        return None

    ensure_storage_dirs()
    source_path = Path(settings.media_root, storage_path)
    thumb_name = Path(storage_path).with_suffix(".jpg").name
    thumb_path = Path(settings.thumb_root, thumb_name)

    try:
        with Image.open(source_path) as img:
            img = img.convert("RGB")
            img.thumbnail(THUMB_SIZE)
            img.save(thumb_path, format="JPEG", quality=85)
    except Exception:
        return None

    return thumb_path.name


def delete_media_files(storage_path: str, thumb_path: Optional[str]) -> None:
    media_file = Path(settings.media_root, storage_path)
    try:
        media_file.unlink(missing_ok=True)
    except Exception:
        pass

    if thumb_path:
        thumb_file = Path(settings.thumb_root, thumb_path)
        try:
            thumb_file.unlink(missing_ok=True)
        except Exception:
            pass
