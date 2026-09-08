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
