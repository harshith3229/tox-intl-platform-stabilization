# TOX INTL Document Processing Platform

This repository is a controlled, partially completed platform used for the TOX INTL Full Stack Developer practical assignment. Read the assignment document before changing code.

## Architecture

- Next.js + React + TypeScript dashboard
- Node.js + Express REST API
- MongoDB document/job state
- Redis as the Celery broker
- Python Celery worker
- Local mock adapter representing Azure Document Intelligence and Azure OpenAI

No Azure subscription, paid service, or production credential is required.

## Fastest setup

Prerequisites: Docker Desktop with Compose v2 and Git.

```bash
cp .env.example .env
docker compose up --build
```

Wait until the worker, API, and web containers are ready, then open <http://localhost:3000>.

To reset the supplied data:

```bash
docker compose down -v
docker compose up --build
```

## Demo identities

The UI includes a demo identity selector. It sends `x-demo-user` to the API.

| Demo user | Organisation |
| --- | --- |
| `alice` | Northwind Finance |
| `bob` | Contoso Operations |

Use only the sample text documents in `samples/`. They contain synthetic data.

## Useful commands

```bash
# Node lint, type checks and tests
npm install
npm run lint
npm run typecheck
npm test

# Worker tests
cd services/worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

## Service URLs

| Service | URL |
| --- | --- |
| Web application | <http://localhost:3000> |
| REST API health | <http://localhost:4000/health> |
| Internal task gateway | <http://localhost:8000/health> inside the Docker network |

## Candidate boundaries

- Treat reported behaviours as symptoms, not confirmed causes.
- Do not connect this repository to real Azure services.
- Do not commit `.env`, credentials, uploaded client documents, or personal data.
- Preserve the deliberately small scope. Large rewrites are not required.
- Keep the baseline application runnable for the live review.

If setup blocks you for more than 45 minutes, record the evidence and continue with the parts you can responsibly analyse.

## Practical assignment — investigation and fixes

See [`BUG_MAP.md`](BUG_MAP.md) for the full investigation (reproduction evidence, root
causes, rejected hypotheses, and two independent findings) and
[`DEPENDENCY_MAP.md`](DEPENDENCY_MAP.md) for the affected-flow/state diagrams.
Fixed: **Issue C** (cross-tenant document access) and **Issue B** (stale UI status +
retry race overwrite). **Issue A** (duplicate upload on double-click) is documented with
reproduction evidence and a proposed fix, but intentionally left unfixed — see
`BUG_MAP.md` for why. See [`MANUAL_REGRESSION.md`](MANUAL_REGRESSION.md) for the manual
regression checklist and [`PRODUCTION_NOTE.md`](PRODUCTION_NOTE.md) /
[`AI_USAGE.md`](AI_USAGE.md) for the remaining required deliverables.

## Known limitations

- **Issue A (duplicate upload) is not fixed**, per the assignment's "fix C plus one of
  A/B" scope. Reproduction evidence and a proposed fix are in `BUG_MAP.md`.
- **Findings 1 and 2** in `BUG_MAP.md` (task-gateway trust boundary; no audit signal
  distinguishing "unknown id" from "wrong org" post-Issue-C) are documented but not
  addressed in this submission.
- **The `failed` terminal status was not exercised live end-to-end.** The mock extractor
  has no path that raises for the supplied sample documents; the attempt-guard fix's
  behaviour for `failed` writes is covered by `test_attempt_guard.py` (which exercises
  the shared guard function directly) but not by a live worker run that actually fails.
- **Docker Desktop needed a manual restart during setup**: the first `docker compose up`
  failed because the Docker engine wasn't running yet, and `docker info`/`docker compose`
  then hung indefinitely (no timeout, no error) rather than failing fast, for several
  minutes even after Docker Desktop was launched. Killing the stuck `Docker Desktop`/
  `com.docker.backend`/`docker` processes, running `wsl --shutdown`, and relaunching
  Docker Desktop resolved it. Not a code issue, but worth flagging for anyone hitting the
  same silent hang on first run.
- No frontend component-level test harness (jsdom/React Testing Library) exists in this
  repo yet. The Issue B1 fix's pure status-decision logic
  (`apps/web/lib/polling.ts`) is unit-tested directly under the existing Node-environment
  Vitest setup; the actual polling `useEffect` behaviour was verified live via an
  automated browser instead of a component test, to avoid adding new test
  infrastructure for a single fix.
