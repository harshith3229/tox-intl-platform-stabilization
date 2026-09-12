# AI usage

## Tools used and tasks

- **Claude Code** (Anthropic CLI agent) was used as a coding assistant for investigation
  support, drafting suggestions, and implementing code/test changes: exploring the starter
  codebase, running the local `docker compose` stack and gathering reproduction evidence
  (curl, worker log inspection, automated browser checks), drafting the fix code for Issue C
  and Issue B, and drafting the accompanying tests.
- **Planning, decisions, and review were mine.** I set the investigation plan and sequence,
  chose Issue B over Issue A as the second required fix, reviewed and approved each proposed
  change before it was applied, directed the verification steps (rebuild containers, re-run
  the live reproduction, run lint/typecheck/test), and made the final call on what shipped
  in each commit. Claude's output was a set of suggestions and drafted diffs, not
  an autonomous decision-making process.

## One accepted suggestion, and how it was verified

Claude suggested guarding **all three** Mongo writes in the worker task (`processing`,
`completed`, `failed`) with the same `{_id, attempt}` filter, not just the terminal
`completed`/`failed` writes. I accepted this because a consistent guard is simpler to reason
about than special-casing which writes need it. I verified it by checking the new
`test_attempt_guard.py` (a fake in-memory collection simulating the exact out-of-order
completion observed live) and then rebuilding the worker container myself and re-running the
original retry-race reproduction end-to-end — confirmed the final document held attempt 2's
result (not attempt 1's) and the worker log showed a `document_processing_stale_write_skipped`
line for the superseded attempt.

## One suggestion rejected or changed, and why

Claude's first draft for the Issue C fix returned `403 Forbidden` when a document existed
but belonged to another organisation. I changed this to `404 Not Found` (matching the
route's existing behaviour for a truly-missing id) — a `403` would itself leak "this id
exists but isn't yours," which is exactly the kind of information disclosure the fix is
meant to close. The route now returns an identical `404` shape for both "doesn't exist" and
"exists, wrong org," which I confirmed via the `documents.test.ts` cross-org test.

## Generated code/tests that required correction

The first version of the worker task's completed/failed logging unconditionally logged
`document_processing_completed`/`document_processing_failed` even when the guarded update's
`matched_count` was `0` (i.e., the write was actually a stale no-op). I flagged this as
misleading (a "completed" line for an attempt whose write was dropped) and had it corrected
to only log completion/failure when the write actually applied. I verified the correction
myself by re-running the live reproduction and reading the worker log output directly
(`docker compose logs worker`) rather than relying on the test suite alone.
