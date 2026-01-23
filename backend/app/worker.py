from celery import Celery

from app.core.config import settings

celery_app = Celery("homesnapshare", broker=settings.redis_url, backend=settings.redis_url)
celery_app.autodiscover_tasks(["app"])


@celery_app.task
def noop():
    return {"status": "ok"}
