import argparse
import logging
import time

from app.core.config import settings
from app.services.importer import scan_import_folder


def main() -> None:
    parser = argparse.ArgumentParser(description="Watch import folder and enqueue media processing.")
    parser.add_argument("--once", action="store_true", help="Run a single scan and exit.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logger = logging.getLogger("importer")

    if not settings.importer_enabled:
        logger.info("Importer disabled via settings.")
        return

    if args.once:
        count = scan_import_folder()
        logger.info("Imported %s file(s).", count)
        return

    interval = max(5, settings.import_interval_seconds)
    logger.info("Watching %s every %ss.", settings.import_root, interval)
    while True:
        count = scan_import_folder()
        if count:
            logger.info("Imported %s file(s).", count)
        time.sleep(interval)


if __name__ == "__main__":
    main()
