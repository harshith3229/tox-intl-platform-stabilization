# Manual regression checklist

Run against a local `docker compose up --build` stack. Automated coverage lives in
`services/api/tests/documents.test.ts`, `services/worker/tests/test_attempt_guard.py`, and
`apps/web/lib/polling.test.ts` — this checklist is the end-to-end pass on top of those.

## Fixed workflow (upload → detail → retry)

- [x] Upload a sample document as `alice`. Dashboard shows it as `queued`, then
      `processing`, then `completed` **without any manual refresh** (polling, Issue B1 fix).
- [x] Open the document's detail page while it is still `processing`, leave the tab
      untouched — it flips to `completed` with the full extraction result on its own
      within one poll interval (~3s). *(Verified live; see `BUG_MAP.md` and the
      `fix(web)` commit message for the exact before/after transcript.)*
- [x] `GET /api/documents/:id` for a document that belongs to the requester's own
      organisation returns `200` with the document.
- [x] `GET /api/documents/:id` for a document belonging to a **different** organisation
      returns `404` (was `200` before the fix — Issue C).
- [x] Retry a document while its previous attempt is still in flight (upload, then call
      retry ~1–2s later, before the mock delay finishes). The final `result.summary` is
      stamped with the **latest** attempt number, and the worker log shows a
      `document_processing_stale_write_skipped` line for the superseded attempt
      (Issue B2 fix).

## Neighbouring behaviours (must remain unaffected)

- [x] `GET /api/documents` (list) as `bob` still correctly returns only Contoso's
      documents (empty, since all test uploads in this session were as `alice`) —
      confirms the fix to `GET /:id` didn't accidentally change the already-correct list
      route.
- [x] `POST /api/documents/:id/retry` on another organisation's document id still
      returns `404` for the requester — confirms org scoping on the retry route is
      unaffected by the detail-route fix.
- [x] `GET /api/documents/not-a-valid-id` still returns `400` (invalid ObjectId
      short-circuits before any DB query, in both the API test and live).
- [x] `x-demo-user: mallory` (unknown identity) still returns `401` on any
      `/api/documents*` route — `demoAuth` middleware is unaffected.
- [x] A `completed` document's detail view (with a populated `result`) renders correctly
      and does **not** keep polling (interval only runs while status is
      `queued`/`processing`).
- [x] Dashboard renders a mixed list of `completed` documents (including two
      deliberately-duplicated ones used to reproduce Issue A) without errors.

## Known gap in this pass

- The `failed` terminal status was exercised only via the worker's unit tests
  (`test_attempt_guard.py`), not a live end-to-end run — the mock extractor
  (`services/worker/app/mock_ai.py`) has no code path that raises for the supplied sample
  documents, so forcing a live `failed` state would require crafting a separate failure
  injection, which was judged out of scope for this timebox.
