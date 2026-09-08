from celery import Celery

from app.config import REDIS_URL

celery = Celery("tox_document_worker", broker=REDIS_URL, backend=REDIS_URL)
celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)

celery.autodiscover_tasks(["app"])
import app.tasks  # noqa: E402,F401
