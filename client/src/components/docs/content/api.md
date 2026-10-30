---
title: REST API
summary: Authenticate with tokens and create, render and export diagrams.
---
# REST API

Base URL: your server, for example `http://localhost:3001`. All bodies are JSON and errors look like `{ "error": "message" }`.

## Authentication

Create a token in **Settings → API tokens** (it is shown once) and send it as a bearer token:

```bash
export TOKEN=ek_your_token
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/files
```

## Diagrams

Create from a prompt (AI) or from code:

```bash
curl -X POST http://localhost:3001/api/v1/diagrams \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"user logs in via an API and database","diagramType":"sequence","theme":"dark"}'
```

```json
{ "id": "a1b2c3", "code": "...", "diagramType": "sequence", "svg": "<svg ...>", "fileUrl": "http://localhost:3001/api/v1/diagrams/a1b2c3.svg" }
```

| Method and path | Purpose |
| --- | --- |
| `POST /api/v1/diagrams` | body `{text?, code?, diagramType, theme?, background?, returnFile?}` |
| `GET /api/v1/diagrams/:id` | the stored code |
| `PUT /api/v1/diagrams/:id` | update `{code}` (creator only) |
| `GET /api/v1/diagrams/:id.svg` | public image, `?theme=dark&background=true` |
| `POST /api/v1/render` | stateless `{code, diagramType, theme?, background?}` → `{svg, width, height, diagnostics}` |
| `GET /api/v1/usage` | files, members and AI requests this month |

## Files

`/api/v1/files` is an alias of `/api/files`:

| Method and path | Purpose |
| --- | --- |
| `GET /api/v1/files?q=&filter=` | list (`all`, `mine`, `shared`, `recent`, `trash`) |
| `POST /api/v1/files` | create `{title?, folderId?, content?}` |
| `GET /api/v1/files/:id` | full file with content |
| `PATCH /api/v1/files/:id` | rename, move, make private, trash, replace content |
| `POST /api/v1/files/:id/ops` | merge `{upsert, remove, doc, title}` |
| `GET /api/v1/files/:id/export?format=json\|md\|svg` | export (`figure`, `theme` for svg) |

## AI

`POST /api/ai/diagram`, `/api/ai/doc` and `/api/ai/repo` are available too. Anonymous callers get 20 requests per hour, authenticated callers 120.
