from fastapi import FastAPI, status
from pydantic import BaseModel, Field

from app.tasks import process_document

app = FastAPI(title="TOX INTL task gateway", docs_url=None, redoc_url=None)


class ProcessingJob(BaseModel):
    documentId: str = Field(min_length=24, max_length=24)
    organisationId: str = Field(min_length=1, max_length=100)
    attempt: int = Field(ge=1, le=20)
    fileName: str = Field(min_length=1, max_length=180)
    sourceText: str = Field(min_length=1, max_length=100_000)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/tasks/process-document", status_code=status.HTTP_202_ACCEPTED)
def enqueue(job: ProcessingJob) -> dict[str, str]:
    task = process_document.delay(
        document_id=job.documentId,
        organisation_id=job.organisationId,
        attempt=job.attempt,
        file_name=job.fileName,
        source_text=job.sourceText,
    )
    return {"taskId": task.id, "status": "queued"}
