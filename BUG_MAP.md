# Bug map

Investigation performed against a local `docker compose up --build` stack (Mongo, Redis,
Celery worker, task-gateway, API on :4000, web on :3000), `MOCK_PROCESSING_DELAY_SECONDS=4`
(the `.env.example` default). Demo identities: `alice` → `org-northwind`, `bob` →
`org-contoso` (see [`services/api/src/middleware/demoAuth.ts`](services/api/src/middleware/demoAuth.ts)).

All timestamps below are from live reproduction runs (container logs / API responses), not
hypothetical.

---

## Issue C — Document detail is not scoped to the signed-in user's organisation (MANDATORY, FIXED)

### Expected vs. actual behaviour
- Expected: `GET /api/documents/:id` returns a document only if it belongs to the
  requesting user's `organisationId`; otherwise `404`.
- Actual: `GET /api/documents/:id` returns any document that matches the id, regardless of
  which organisation the requester belongs to.

### Evidence
1. Uploaded a document as `alice` (org `org-northwind`):
   ```
   POST /api/documents  (x-demo-user: alice)
   -> 202 { item: { _id: "6aa42b87d73eeae51e9b0c9e", organisationId: "org-northwind", ... } }
   ```
2. Fetched that same id as `bob` (org `org-contoso`):
   ```
   GET /api/documents/6aa42b87d73eeae51e9b0c9e  (x-demo-user: bob)
   -> HTTP/1.1 200 OK
   { "item": { "_id": "6aa42b87d73eeae51e9b0c9e", "organisationId": "org-northwind",
       "uploadedBy": "user-alice", "fileName": "invoice-northwind.txt", "status": "processing", ... } }
   ```
   Bob received Alice's org-northwind document in full — cross-tenant data exposure.
3. Contrast: `GET /api/documents` (list) as `bob` immediately after correctly returns
   `{"items":[]}` — the list route *does* scope by organisation. Only the single-document
   route is missing the filter.

### Likely root cause (high confidence)
[`services/api/src/routes/documents.ts:60-80`](services/api/src/routes/documents.ts) —
the `GET /:id` handler queries `DocumentRecord.findById(req.params.id)` with no
`organisationId` condition. Every other route in the same file (`GET /`, `POST /:id/retry`)
does include `organisationId: req.demoUser.organisationId` in its query — this is a single
missing filter on one route, not a systemic auth gap.

**Rejected hypothesis:** "the `demoAuth` middleware isn't running for this route, so there's
no identity at all." Ruled out — `demoAuth` is mounted globally on `/api/documents`
([`app.ts:16`](services/api/src/app.ts)), `req.demoUser` is populated and returned
correctly in the response body (`uploadedBy` is unaffected), and the sibling `GET /` and
`POST /:id/retry` routes on the same router correctly enforce org scope using the same
`req.demoUser.organisationId` value. The identity is present and correct; only the query
filter on this one route is missing.

### Dependency impact
- **Modules:** `services/api/src/routes/documents.ts` only.
- **API contract:** `GET /api/documents/:id` response shape is unchanged; only its matching
  condition changes. A cross-tenant request now returns `404` instead of `200` — this is a
  contract *tightening*, not a breaking change for any legitimate client.
- **Users affected:** every organisation is currently exposed to every other organisation's
  document metadata (not file contents, since `sourceText` is excluded from all read
  projections) via a guessable/enumerable 24-hex Mongo ObjectId.
- **Data states:** no data migration needed; this is a read-path fix only.

### Priority
**Critical / high likelihood.** Any authenticated demo user can read any other org's
document status, filenames, and extraction results (invoice numbers, suppliers, totals) by
ID. This is the assignment's mandatory fix and the most severe of the three symptoms
(confirmed cross-tenant data exposure, not just a UX defect).

### Fix and validation
**Fix:** change the query to `DocumentRecord.findOne({ _id: req.params.id, organisationId:
req.demoUser.organisationId })`, mirroring the existing `retry` route pattern. Keep the
`404` (not `403`) response on no-match so the fix doesn't itself leak "this id exists but
isn't yours."
**Validation:** `services/api/tests/documents.test.ts` covers same-org fetch (200),
cross-org fetch (404), and invalid id (400). Manually re-ran the exact reproduction above
post-fix (see `MANUAL_REGRESSION.md`).

---

## Issue B — Stale status display and late-result overwrite on retry (SECOND FIX, FIXED)

This symptom has two independent root causes; both are required to fully address the
reported behaviour.

### B1 — UI never refreshes without a manual action

**Expected vs. actual:** Expected: once a job completes server-side, the dashboard/detail
view reflects it within a short, bounded time. Actual: the view only fetches once on mount
plus on an explicit user action (upload, or the "Refresh" button); nothing re-polls.

**Evidence (live browser reproduction):**
1. Uploaded `invoice-stale-ui-test.txt` as alice at `16:27:55.745Z`; opened
   `/documents/6aa42c0bd73eeae51e9b0cb2?user=alice` immediately — page showed
   `STATUS: Processing`.
2. Confirmed via direct API call ~12s later that the server-side record was already
   `status: "completed"` with a full `result` (invoice NW-7777, Stale UI Test Co, INR 500).
3. Re-read the **same, untouched** browser tab (no reload, no click) — it still showed
   `STATUS: Processing` / "No extraction result is available yet."
4. Clicked the existing "Refresh" button — the same tab immediately updated to
   `STATUS: Completed` with the full extraction result. This confirms the data path and
   component logic are correct; only the trigger to re-fetch is missing.

**Likely root cause (high confidence):**
[`apps/web/components/Dashboard.tsx`](apps/web/components/Dashboard.tsx) and
[`apps/web/components/DocumentDetail.tsx`](apps/web/components/DocumentDetail.tsx) each
have exactly one `useEffect` that fetches on mount (and on `user`/`documentId` change) —
no `setInterval`/polling and no other re-fetch trigger.

### B2 — A late-finishing earlier attempt can overwrite a newer retry's result

**Expected vs. actual:** Expected: once a user retries a job, the newer attempt's outcome
is what's ultimately stored, even if the previous attempt's async task is still in flight.
Actual: whichever attempt's Celery task finishes *last* wins, regardless of which attempt
is actually newer.

**Evidence (live reproduction, worker logs + DB state):**
1. Uploaded `invoice-race-test.txt` as alice at `16:26:22.631Z` (attempt 1 enqueued,
   `processing_delay(1) = 8s`).
2. Called `POST /:id/retry` at `~16:26:24.01Z`, while attempt 1 was still running. This
   `$inc`s `attempt` to `2` and enqueues a new task (`processing_delay(2) = 2s`).
3. Worker log (`docker compose logs worker`):
   ```
   16:26:22,645 document_processing_started document_id=...ca2 attempt=1
   16:26:24,042 document_processing_started document_id=...ca2 attempt=2
   16:26:26,051 document_processing_completed document_id=...ca2 attempt=2   <- newer attempt finishes first
   16:26:30,653 document_processing_completed document_id=...ca2 attempt=1   <- stale attempt finishes last, overwrites
   ```
4. Final document state:
   ```json
   { "attempt": 2, "status": "completed",
     "result": { "summary": "Invoice NW-9001 from Race Test Supplier (attempt 1)" } }
   ```
   The document's `attempt` counter says `2` (the retry is the latest attempt) but the
   stored `result` is stamped `(attempt 1)` — direct proof the stale attempt's write
   clobbered the newer attempt's result.

**Likely root cause (high confidence):**
[`services/worker/app/tasks.py:39-55`](services/worker/app/tasks.py) — both the
`"processing"` and the terminal (`"completed"`/`"failed"`) `update_one` calls filter only
on `{"_id": object_id}`, with no condition tying the write to the `attempt` the task was
started with. Any task, however stale, can overwrite the document regardless of how many
newer attempts have since started or finished.

**Rejected hypothesis (for B, combined):** "The Celery task itself is retried/duplicated
(e.g. `max_retries=2` firing twice for one attempt), not a genuine two-attempt race." Ruled
out — the worker log clearly shows two distinct task ids
(`4e48c9ff-...` for attempt 2, `7ff13b0b-...` for attempt 1) each logged exactly once as
`received`/`succeeded`, matching the one API-level upload + one API-level retry call made.
This is a genuine cross-attempt race, not Celery's own retry mechanism.

### Dependency impact
- **Modules:** `apps/web/components/Dashboard.tsx`, `apps/web/components/DocumentDetail.tsx`
  (B1); `services/worker/app/tasks.py` (B2).
- **API/schema contracts:** unchanged. B2's fix adds a query filter to existing Mongo
  writes; no schema change.
- **Data states:** documents already corrupted by this race (attempt counter ahead of the
  stored result) cannot be distinguished from correct ones after the fact without
  re-processing — noted in `PRODUCTION_NOTE.md`.
- **Users affected:** anyone who retries a job while the previous attempt is still running
  (B2); every user, since no view ever auto-refreshes (B1).

### Priority
**High.** Directly causes the reported "stale or incorrect user outcome" business risk:
users can see a wrong terminal state (B1, cosmetic but confusing) or a *silently wrong*
extraction result while the UI reports the job as "Completed" with no indication it's
stale (B2, a data-correctness issue, more severe than B1).

### Fix and validation
**B1 fix:** add a lightweight polling loop (`setInterval`) in `Dashboard.tsx` and
`DocumentDetail.tsx` that re-fetches while any visible item is in a non-terminal state
(`queued`/`processing`), clearing itself once terminal or on unmount. Manual "Refresh"
stays as a fallback.
**B2 fix:** make every worker `update_one` call conditional on `{"_id": object_id,
"attempt": attempt}` so a task can only write the document while it is still on the attempt
it was started with; log (not raise) when a stale write is correctly dropped
(`matched_count == 0`).
**Validation:** worker unit test simulating out-of-order completion (fast attempt 2 finishes
before slow attempt 1) asserting the final stored result is attempt 2's, not attempt 1's —
this is exactly the scenario reproduced live above. Manual regression: repeat the retry-race
reproduction post-fix and confirm the final `result.summary` says `(attempt 2)`.

---

## Issue A — Duplicate upload on double-click / retried request (DOCUMENTED, NOT FIXED)

Per the assignment's required-fix scope, Issue C plus one of A/B must be fixed; B was
chosen as the second fix. Issue A is documented here with reproduction evidence and a
fix proposal, but left unfixed in this submission.

### Expected vs. actual behaviour
- Expected: two upload requests carrying identical content from the same user/org (e.g. a
  double-click, or a client retry after a dropped response) produce **one** job.
- Actual: each `POST /api/documents` unconditionally creates a new `DocumentRecord` and
  enqueues a new processing job, even when its `uploadFingerprint` exactly matches an
  existing record.

### Evidence
Fired two concurrent, byte-identical `POST /api/documents` requests as alice:
```
-> 202 { _id: "6aa42c3fd73eeae51e9b0cb7", uploadFingerprint: "078212a2e4342ff3...", status: "queued" }
-> 202 { _id: "6aa42c3fd73eeae51e9b0cb9", uploadFingerprint: "078212a2e4342ff3...", status: "queued" }
```
Both records share the identical `uploadFingerprint` (same org + fileName + content hash)
but have distinct `_id`s, and both transitioned to `"processing"` independently — i.e. two
billable extraction jobs for what a user experiences as a single upload action.

### Likely root cause (high confidence)
[`services/api/src/routes/documents.ts:29-58`](services/api/src/routes/documents.ts)
computes `uploadFingerprint` but never queries for an existing record with the same
fingerprint before inserting. [`services/api/src/models/DocumentRecord.ts:23`](services/api/src/models/DocumentRecord.ts)
declares the field `index: true` (for lookup speed) but not `unique: true`, so MongoDB
itself doesn't reject the duplicate either.

### Dependency impact
- **Modules:** `services/api/src/routes/documents.ts` (`POST /`), `DocumentRecord` schema.
- **Business risk:** duplicate AI/OCR processing cost, duplicate rows in any downstream
  reporting, and a confusing dashboard (two rows for what the user thinks is one upload).
- **API contract:** a fix would need to decide the response for a detected duplicate —
  proposed: return the existing record with `200` (not `202`) rather than erroring, so the
  client doesn't need special-case handling.

### Priority
**Medium.** Real cost/consistency impact, but lower severity than C (no security exposure)
and no risk of silently wrong data being shown as correct (unlike B2) — a duplicate job
still produces a *correct* result, just twice.

### Proposed fix (not implemented here)
Add a unique compound index on `{ organisationId: 1, uploadFingerprint: 1 }`; in the `POST /`
handler, `findOne` for an existing record with that fingerprint first (or catch the unique-
index violation) and return the existing record instead of creating a new one.

---

## Independent findings

Two additional risks identified while investigating the supplied scope, distinct from the
three reported symptoms above. Not fixed in this submission (out of the required two-fix
budget); documented per the assignment's "additional engineering judgement" requirement.

### Finding 1 — task-gateway trusts the caller's `organisationId` with no cross-check (non-visual, security/authorization)

**Evidence:** [`services/worker/app/gateway.py`](services/worker/app/gateway.py) accepts a
`ProcessingJob` (`documentId`, `organisationId`, `attempt`, `fileName`, `sourceText`) over
plain HTTP with no authentication, and never verifies that `organisationId` actually matches
the `organisationId` already stored on `documentId` in MongoDB before enqueuing — it simply
trusts whatever the caller claims and the worker writes back to that same `_id` regardless.
Today the only caller is the API's `enqueueProcessing()`, which populates the field
honestly, so this isn't currently exploitable end-to-end. But there is no second line of
defense: the gateway container publishes no port to the host today (`docker-compose.yml`
has no `ports:` entry for `task-gateway`), so the blast radius is limited to whatever else
runs on the Docker network — but that is topology-dependent hardening, not an
application-level control.

**Severity:** Medium (defense-in-depth gap, not independently exploitable today).
**Impact:** If any other internal service ever gained network access to the gateway (or a
future change exposed its port), it could enqueue a job that overwrites a document's status
under an `organisationId` that doesn't match its real owner — a "confused deputy" that would
undermine the Issue C fix from a different angle.
**Next action:** Add a check in the worker task (or the gateway) that the document's stored
`organisationId` matches the job's claimed `organisationId` before writing, and/or put a
shared secret / mTLS between the API and the gateway.

### Finding 2 — no signal to distinguish "not found" from "blocked cross-tenant attempt" (non-visual, observability/security)

**Evidence:** After the Issue C fix, `GET /api/documents/:id` returns a generic `404` both
when the id genuinely doesn't exist and when it exists but belongs to another organisation
(intentional, to avoid leaking existence — see the fix rationale above). However, nothing
in [`services/api/src/routes/documents.ts`](services/api/src/routes/documents.ts) or its
surrounding logging distinguishes these two cases server-side either. There is currently no
log line, metric, or audit trail that would let an operator notice "org X is repeatedly
requesting document ids that belong to org Y" — i.e. no way to detect active exploitation
attempts of the very class of bug just fixed, or a client-side bug leaking ids across orgs.

**Severity:** Medium (no data exposure by itself, but a real gap in the ability to detect
abuse or regressions of Issue C going forward).
**Impact:** A future regression of the Issue C fix, or an actual attempted exploitation,
would be invisible in current logs/metrics — the team would only find out from a support
report, not monitoring.
**Next action:** Add a structured log line (without document content) when a lookup misses
specifically *because* of an organisation mismatch (as opposed to a truly unknown id), and
alert on a sustained rate of these from a single organisation — this is exactly the kind of
signal called out in `PRODUCTION_NOTE.md`'s monitoring section.
