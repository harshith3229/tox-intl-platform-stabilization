"""Regression coverage for Issue B2: a late-finishing, superseded attempt must
not overwrite a newer retry's result.

Uses a tiny in-memory fake Mongo collection instead of a real database or a
mocking library -- `update_one` only needs to support the exact filter shape
`apply_attempt_guarded_update` sends (`_id` + `attempt` equality) plus `$set`.
"""

from dataclasses import dataclass, field
from typing import Any

from bson import ObjectId

from app.tasks import apply_attempt_guarded_update


@dataclass
class FakeUpdateResult:
    matched_count: int


@dataclass
class FakeRecordsCollection:
    documents: dict[ObjectId, dict[str, Any]] = field(default_factory=dict)

    def insert(self, object_id: ObjectId, attempt: int) -> None:
        self.documents[object_id] = {"_id": object_id, "attempt": attempt, "status": "queued"}

    def update_one(self, filter_: dict[str, Any], update: dict[str, Any]) -> FakeUpdateResult:
        doc = self.documents.get(filter_["_id"])
        if doc is None or doc.get("attempt") != filter_.get("attempt"):
            return FakeUpdateResult(matched_count=0)
        doc.update(update["$set"])
        return FakeUpdateResult(matched_count=1)


def test_stale_attempt_completion_does_not_overwrite_newer_attempt() -> None:
    records = FakeRecordsCollection()
    object_id = ObjectId()
    records.insert(object_id, attempt=1)

    # A retry bumps the document to attempt 2 before attempt 1's task finishes
    # (mirrors the API's /retry route incrementing `attempt`).
    records.documents[object_id]["attempt"] = 2

    # Attempt 2 (the newer, faster attempt) finishes first.
    result_attempt_2 = apply_attempt_guarded_update(
        records, object_id, attempt=2, fields={"status": "completed", "result": "attempt-2-result"}
    )
    assert result_attempt_2.matched_count == 1
    assert records.documents[object_id]["status"] == "completed"
    assert records.documents[object_id]["result"] == "attempt-2-result"

    # Attempt 1 (stale, slower) finishes later and must NOT overwrite attempt 2's result.
    result_attempt_1 = apply_attempt_guarded_update(
        records, object_id, attempt=1, fields={"status": "completed", "result": "attempt-1-result"}
    )
    assert result_attempt_1.matched_count == 0, "stale attempt's write should be a no-op"
    assert records.documents[object_id]["result"] == "attempt-2-result", (
        "the document must still hold the newer attempt's result"
    )
    assert records.documents[object_id]["attempt"] == 2


def test_matching_attempt_write_applies_normally() -> None:
    records = FakeRecordsCollection()
    object_id = ObjectId()
    records.insert(object_id, attempt=1)

    result = apply_attempt_guarded_update(
        records, object_id, attempt=1, fields={"status": "processing"}
    )

    assert result.matched_count == 1
    assert records.documents[object_id]["status"] == "processing"


def test_write_for_unknown_document_is_a_safe_no_op() -> None:
    records = FakeRecordsCollection()
    missing_id = ObjectId()

    result = apply_attempt_guarded_update(
        records, missing_id, attempt=1, fields={"status": "processing"}
    )

    assert result.matched_count == 0
