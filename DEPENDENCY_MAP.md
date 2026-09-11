# Dependency map — document upload / processing / status workflow

Scope: only the path exercised by the three reported symptoms (upload → API →
Mongo → task-gateway → Redis → Celery worker → Mongo → UI). Enforcement points
are marked as they exist **after** the Issue C and Issue B fixes in this
submission; Issue A (idempotency) is marked as still missing, since it is
documented but not fixed here.

```mermaid
flowchart TD
    U[User clicks Upload] -->|POST /api/documents<br/>x-demo-user header| MW[demoAuth middleware<br/>resolves org from header]
    MW -->|"⚠ NOT ENFORCED (Issue A)<br/>no uploadFingerprint check"| INS[Mongo insert<br/>DocumentRecord status=queued attempt=1]
    INS --> ENQ[API -> task-gateway<br/>POST /tasks/process-document]
    ENQ --> RQ[(Redis queue)]
    RQ --> W1[Celery worker picks up task<br/>attempt=N]
    W1 -->|"✅ ENFORCED (fixed)<br/>update_one filters on<br/>_id AND attempt=N"| SETP[Mongo: status=processing]
    SETP --> MOCK[Mock OCR/AI extraction<br/>processing_delay by attempt]
    MOCK -->|"✅ ENFORCED (fixed)<br/>update_one filters on<br/>_id AND attempt=N"| SETC[Mongo: status=completed/failed<br/>+ result]

    UI1[Dashboard / Detail view] -->|GET /api/documents<br/>filters organisationId| SETC
    UI1 -->|"✅ ENFORCED (fixed)<br/>GET /:id now filters<br/>organisationId too"| DETAIL[Document detail]
    SETC -.->|"✅ ENFORCED (fixed)<br/>poll every 3s while<br/>status is queued/processing"| UI1

    RETRY[User clicks Retry] -->|POST /:id/retry<br/>scoped by organisationId| INC[Mongo: attempt += 1<br/>status=queued]
    INC --> ENQ2[API -> task-gateway<br/>new task, attempt=N+1]
    ENQ2 --> RQ

    classDef enforced fill:#1f7a3f,color:#fff,stroke:#145c2c;
    classDef missing fill:#8a3b12,color:#fff,stroke:#5c2a0c;
    class SETP,SETC,DETAIL,UI1 enforced;
    class INS missing;
```

## State transitions (per document)

```mermaid
stateDiagram-v2
    [*] --> queued: POST /api/documents (attempt=1)
    queued --> processing: worker starts task<br/>guarded by attempt match
    processing --> completed: extraction succeeds<br/>guarded by attempt match
    processing --> failed: extraction raises<br/>guarded by attempt match
    failed --> queued: POST /:id/retry (attempt += 1)
    completed --> queued: POST /:id/retry (attempt += 1)

    note right of processing
        Two concurrent attempts (N and N+1)
        can both be "in flight" here if a
        retry fires before the prior attempt's
        task finishes. Only the write whose
        attempt matches the document's current
        attempt is applied (fixed) -- a stale
        attempt's write is now a silent no-op
        instead of an overwrite.
    end note
```

## Enforcement points, called out explicitly

| Boundary | What must be enforced | Status in this submission |
| --- | --- | --- |
| `POST /api/documents` → Mongo insert | Idempotency (same org+content shouldn't create 2 jobs) | ❌ **Missing** — Issue A, documented not fixed. `uploadFingerprint` is computed but never checked. |
| `GET /api/documents/:id` → Mongo read | Tenant scope (org must match requester) | ✅ **Fixed** (Issue C) — now filters `organisationId`, returns 404 on mismatch instead of leaking the record. |
| `POST /:id/retry` → Mongo update | Tenant scope | ✅ Was already enforced; unchanged. |
| Worker `update_one` (processing / completed / failed) | Retry/attempt monotonicity (a stale in-flight task must not overwrite a newer attempt's state) | ✅ **Fixed** (Issue B2) — write is now conditioned on `{_id, attempt}` matching the task's own attempt. |
| Terminal states (`completed`, `failed`) | Once terminal, only a fresh `retry` (which bumps `attempt` and resets to `queued`) should transition the document again | ✅ Enforced by the same attempt-matched write — a task from a superseded attempt can no longer flip a document out of a newer terminal state. |
| UI (`Dashboard`, `DocumentDetail`) → API | Timely reflection of server-side state changes | ✅ **Fixed** (Issue B1) — polls while non-terminal; manual Refresh retained as a fallback. |

## Out of scope for this diagram

Authentication itself (`demoAuth`) is a stub identity resolver, not a full auth
system, and is unchanged by this work. Upload content validation (`zod` schema
on `fileName`/`content`) is enforced upstream of everything shown here and was
not found to be defective.
