import argparse
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.core.config import settings
from app.services.importer import scan_import_folder


def _random_date(rng: random.Random, start: datetime, end: datetime) -> datetime:
    delta = end - start
    seconds = rng.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=seconds)


def _write_image(path: Path, label: str, size: tuple[int, int], color: tuple[int, int, int]) -> None:
    image = Image.new("RGB", size, color=color)
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    draw.text((20, 20), label, fill=(255, 255, 255), font=font)
    image.save(path, format="JPEG", quality=85)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo media into the import folder.")
    parser.add_argument("--count", type=int, default=24, help="Number of images to generate.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    parser.add_argument("--import-now", action="store_true", help="Run importer once after seeding.")
    args = parser.parse_args()

    import_root = Path(settings.import_root)
    import_root.mkdir(parents=True, exist_ok=True)

    rng = random.Random(args.seed)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=365 * 2)

    colors = [
        (30, 30, 30),
        (200, 80, 70),
        (80, 160, 220),
        (90, 180, 120),
        (220, 190, 80),
    ]

    for i in range(args.count):
        date = _random_date(rng, start, now)
        stamp = date.strftime("%Y%m%d")
        filename = f"demo_{i:03d}_{stamp}.jpg"
        path = import_root / filename
        label = f"Demo {i:03d} {stamp}"
        color = colors[i % len(colors)]
        _write_image(path, label, (1280, 720), color)
        ts = date.timestamp()
        path.chmod(0o644)
        os.utime(path, (ts, ts))

    if args.import_now:
        scan_import_folder()


if __name__ == "__main__":
    main()
