---
title: Self-hosting
summary: Run easydraw on your own machine or server.
---
# Self-hosting

easydraw is a static React client plus a small Bun server with a SQLite file. There is nothing else to run.

## Run locally

```bash
git clone https://github.com/my-itemss/easydraw
cd easydraw/server && bun install && bun index.ts     # http://localhost:3001
cd ../client && bun install && bun run dev            # http://localhost:5173
```

## Server environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP and WebSocket port |
| `DB_PATH` | `canvas.db` | SQLite file location (back this up) |
| `CLIENT_ORIGINS` | – | comma-separated extra origins allowed by CORS |
| `ANTHROPIC_API_KEY` | – | enables Claude for AI generation |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | model used for AI |

## Client environment

Set `VITE_API_URL` to the public URL of your server before building (`bun run build`) and host the `dist` folder on any static host, such as Vercel, Netlify or an S3 bucket. All routes must fall back to `index.html` (the repo includes a `vercel.json` for this).

## Production notes

- Put the server behind HTTPS; WebSockets use the same host (`wss://`).
- Add your client origin to `CLIENT_ORIGINS`.
- Back up the SQLite file; it holds users, files, versions and tokens.
- There is no sign-in: everyone who can reach the server shares one workspace. Run it on a private network or behind your own access proxy (VPN, basic auth, SSO proxy) if the data is sensitive.
