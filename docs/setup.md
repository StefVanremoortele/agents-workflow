# agent-harness — Setup & Onboarding

> Local observability/control dashboard for agentic development workflows. A Node HTTP server ingests structured events, persists them in SQLite, reduces them into live agent/task state, evaluates trigger rules, and streams updates to a React Fleet Control dashboard.

## Best starting points

For a thorough onboarding path, read:

1. `AGENTS.md`
2. `documents/START_HERE.md`
3. `documents/project-map.md`
4. `documents/architecture.md`
5. `documents/api-reference.md`
6. `documents/dashboard.md`

## Tech stack

- **Language:** TypeScript, ESM, `moduleResolution` NodeNext.
- **Runtime:** Node.js 18+.
- **Backend:** framework-free Node `http` server in `src/server.ts`.
- **Storage:** SQLite via `better-sqlite3` in `src/db.ts`.
- **Frontend:** React + Vite in `src/web/main.tsx`.
- **Realtime:** Server-Sent Events at `/stream`.

## Getting it running

```bash
npm install
npm run dev
```

This runs:

- server: `http://localhost:4000`
- Vite web app: usually `http://localhost:5173`

Run separately:

```bash
npm run dev:server
npm run dev:web
```

Build:

```bash
npm run build
```

Start built server:

```bash
npm run start:server
```

Smoke check:

```bash
curl http://localhost:4000/health
```

Expected:

```json
{ "ok": true, "service": "harness-server", "version": "0.1.0" }
```

## Install Pi reporting globally

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000
```

This copies `.pi/extensions/harness-reporter.ts` to `~/.pi/agent/extensions/harness-reporter.ts`, so any pi session in any project reports to this harness. Restart pi or run `/reload` after installing.

Optional global display name:

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000 --source-name "Pi Agent"
```

## Architecture overview

| Path | Contents |
|---|---|
| `src/server.ts` | HTTP routes, validation, CORS, SSE, outbox import |
| `src/store.ts` | Event reduction into agents/tasks/alerts/conclusions/dashboard |
| `src/db.ts` | SQLite persistence |
| `src/types.ts` | Shared domain types |
| `src/web/main.tsx` | Fleet Control React app and detail view |
| `src/web/styles.css` | Fleet Control styling |
| `.pi/extensions/harness-reporter.ts` | Pi producer extension |
| `adapters/claude-code-hook.mjs` | Claude Code hook producer |

## Data flow

1. A producer `POST`s an event envelope to `/events`.
2. `src/server.ts` validates it and calls `HarnessStore.addEvent`.
3. `src/store.ts` persists/reduces state through `src/db.ts`.
4. The server broadcasts SSE frames such as `event.created`, `agent.updated`, `agents.updated`, `tasks.updated`, and `dashboard.updated`.
5. The React app updates the fleet overview/detail view.

## HTTP API

Main endpoints:

- `GET /health`
- `POST /events`
- `GET /dashboard`
- `GET /agents`
- `PUT /agents/:id`
- `GET /events?limit=100`
- `GET /tasks`
- `GET /conclusions`
- `GET /alerts`
- `POST /alerts/:id/ack`
- `GET /rules`
- `POST /rules`
- `PUT /rules/:id`
- `DELETE /rules/:id`
- `GET /stream`

See `documents/api-reference.md` for details.

## Configuration & environment

- `PORT` — server port, default `4000`.
- `HARNESS_DB_PATH` — SQLite path, default `.harness/harness.db`.
- `HARNESS_OUTBOX_PATH` — outbox path, default `.harness/outbox.jsonl`.
- `HARNESS_SERVER_URL` — producer target, default `http://localhost:4000`.
- `HARNESS_SOURCE_ID` / `HARNESS_SOURCE_NAME` — producer identity overrides.
- `PI_HARNESS_CONFIG` — explicit Pi config file override.

Runtime artifacts are under `.harness/` by default. Generated build outputs are `dist-server/` and `dist/`.

## Current UI

Fleet Control includes:

- cards/table fleet views
- status filters
- live throughput and sparklines
- inline rename
- agent detail view with task progress, checklist, metadata, throughput, and activity log

Pause/Stop/Respond controls are currently visual placeholders; control APIs are not implemented yet.
