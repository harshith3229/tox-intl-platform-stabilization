# Architecture overview

```mermaid
flowchart LR
    UI[Next.js UI] --> API[Express API]
    API --> DB[(MongoDB)]
    API --> GW[Task gateway]
    GW --> R[(Redis)]
    R --> W[Celery worker]
    W --> AI[Mock OCR and AI]
    W --> DB
```

The mock adapter returns deterministic extraction results from synthetic text input. The gateway exists only to bridge the Node REST API to the existing Celery boundary. Candidates should focus on the document workflow described in the assignment.
