# PR summary: fix Issue C (cross-tenant access) + Issue B (stale status / retry race)

## What was broken and how it was reproduced

Reproduced against a local `docker compose up --build` stack (see `BUG_MAP.md` for full
transcripts):

- **Issue C:** `GET /api/documents/:id` returned any document regardless of the requester's
  organisation. Uploaded a document as `alice` (org-northwind), then fetched it as `bob`
  (org-contoso) — got `200` with Alice's full document instead of `404`.
- **Issue B1:** the dashboard/detail views never auto-refresh. Opened a document mid-
  processing, confirmed via direct API call that the server-side record had already flipped
  to `completed`, and the open, untouched browser tab still showed "Processing" until the
  manual Refresh button was clicked.
- **Issue B2:** retrying a job while its previous attempt was still in flight let the
  slower, superseded attempt's completion overwrite the newer attempt's result. Worker logs
  showed attempt 2 completing first and attempt 1 completing 4.6s later and clobbering it —
  final document had `attempt: 2` but a result stamped `"(attempt 1)"`.
- **Issue A** (documented, not fixed): two concurrent identical uploads created two
  `DocumentRecord`s sharing the same `uploadFingerprint`.

## Root cause and why the chosen fix is scoped narrowly

- **Issue C:** `documents.ts`'s `GET /:id` used `findById()` with no `organisationId`
  filter, unlike its sibling routes in the same file. Fix: `findOne({ _id, organisationId })`,
  mirroring the existing pattern already used by `GET /` and `POST /:id/retry`. One-line
  query change; response shape and legitimate-caller behaviour unchanged.
- **Issue B:** two independent gaps — (1) no polling in the React components (single
  fetch-on-mount only), (2) every worker `update_one` filtered only on `_id`, with no check
  that the write still belonged to the document's current attempt. Fixes: a `setInterval`
  poll while status is non-terminal (existing manual Refresh kept as fallback), and a shared
  `apply_attempt_guarded_update()` helper that scopes every worker write to
  `{_id, attempt}` so a stale write becomes a safe no-op instead of an overwrite.

No API contract or schema changes in either fix.

## Files/modules changed and likely regression surface

- `services/api/src/routes/documents.ts` — `GET /:id` only. Regression surface: any client
  relying on cross-org document reads would break (none exist/should exist).
- `services/worker/app/tasks.py` — all three status-write call sites, refactored through one
  new helper. Regression surface: any code relying on a write applying regardless of attempt
  (none identified); logging output changed slightly (a stale write now logs
  `document_processing_stale_write_skipped` instead of a misleading `_completed`/`_failed`
  line).
- `apps/web/components/Dashboard.tsx`, `apps/web/components/DocumentDetail.tsx`,
  new `apps/web/lib/polling.ts` — added polling only; no existing behaviour removed.
  Regression surface: additional network requests every 3s while a job is active (bounded,
  self-clearing on terminal status/unmount).

## Tests/evidence showing the fix works

- `services/api/tests/documents.test.ts` (3 tests): same-org 200, cross-org 404, invalid id
  400 — written failing against pre-fix code, passing after.
- `services/worker/tests/test_attempt_guard.py` (3 tests): reproduces the exact out-of-order
  completion scenario seen live; asserts the stale write is a no-op and the newer result
  survives.
- `apps/web/lib/polling.test.ts` (7 tests): unit-tests the active/terminal status logic
  driving the poll loop.
- All three fixes were also re-verified live end-to-end against rebuilt containers (see
  `BUG_MAP.md` and `MANUAL_REGRESSION.md` for full transcripts), plus a 6-item neighbouring-
  behaviour regression pass (list route scoping, retry route scoping, invalid id, unknown
  demo user, completed-doc render, mixed-status dashboard render).
- Full `npm run lint && npm run typecheck && npm test` (root) and worker `pytest`/`ruff`
  pass, matching every step in `.azuredevops/azure-pipelines.yml`.

## Known limitations and what's next

- Issue A (duplicate upload) is documented with reproduction evidence and a proposed fix
  (unique compound index + find-or-create in `POST /`) but intentionally left unfixed —
  out of the required two-fix budget.
- Two independent findings documented but not fixed: the task-gateway trusts the caller's
  `organisationId` with no cross-check against Mongo, and there's no log/metric
  distinguishing "unknown id" from "wrong org" after the Issue C fix (see `BUG_MAP.md`
  "Independent findings").
- The worker's `failed` terminal path is covered by unit tests only, not a live end-to-end
  run (the mock extractor has no path that raises for the supplied samples).
- See `PRODUCTION_NOTE.md` for rollout/monitoring/rollback/data-repair considerations
  before releasing these two fixes.
