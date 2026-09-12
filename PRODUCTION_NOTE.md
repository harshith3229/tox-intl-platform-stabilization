# Production readiness note

Before releasing the Issue C (tenant-scope) and Issue B (stale status / retry race) fixes:

**Rollout.** Both fixes are small, backward-compatible diffs (no schema change, no new env
vars). Deploy API and worker together — shipping both in one release avoids a window where
an old, unconditional-write worker runs against fixed clients. A staged rollout (one
API+worker pod first) is sufficient; no feature flag needed given the small blast radius.

**Monitoring.** Watch the 404 rate on `GET /api/documents/:id` post-deploy — a spike could
mean legitimate cross-org attempts now correctly blocked (good) or a client bug surfacing
(investigate). Watch the new `document_processing_stale_write_skipped` worker log line's
rate; a high rate suggests unusually frequent retries or too-short a mock delay relative to
retry behavior. Per Finding 2 in `BUG_MAP.md`, logs can't yet distinguish "unknown id" from
"wrong org" — add that signal soon after rollout for real abuse detection.

**Rollback.** Both fixes are single-commit, additive-filter changes with no tied data
migration — reverting either commit and redeploying is safe and immediate.

**Data repair.** Issue C was read-only (no writes corrupted, only over-exposed) — no repair
needed. Issue B2 may have already corrupted existing documents: any document whose `attempt`
counter is higher than what its `result.summary` reports (the exact signature reproduced in
`BUG_MAP.md`) has a stale result. These can't be distinguished from correct documents without
inspection; the safe repair is a one-off script that re-enqueues processing for any
`completed`/`failed` document with `updatedAt` before this deploy, so it gets a fresh,
correctly-guarded result.
