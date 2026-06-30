# Architecture

## Goal

Build an agent-agnostic central server that receives structured events from agents, tools, scripts, and CI jobs; persists those events locally; reduces them into live agent/task state; evaluates noteworthy output through trigger rules; and broadcasts updates to connected clients.

The primary client is the React **Fleet Control** web app.

## High-level flow

```text
Pi / Claude Code / scripts / CI / tools
        │
        │ POST structured events
        ▼
Node Harness Server (`src/server.ts`)
        │
        ├─ validates event envelopes
        ├─ persists to SQLite via `src/db.ts`
        ├─ reduces events through `src/store.ts`
        │    ├─ agents
        │    ├─ tasks
        │    ├─ conclusions
        │    ├─ alerts
        │    └─ dashboard summary
        └─ streams realtime updates over SSE
              │
              ▼
React Fleet Control (`src/web/main.tsx`)
```

## Server responsibilities

`src/server.ts` currently handles:

- `POST /events` event intake.
- request validation.
- REST snapshot endpoints for dashboard, agents, events, tasks, alerts, conclusions, and rules.
- agent rename endpoint.
- alert acknowledgement endpoint.
- rule create/update/delete endpoints.
- Server-Sent Events broadcasting at `GET /stream`.
- offline outbox import from `.harness/outbox.jsonl` on startup.

## Store responsibilities

`src/store.ts` owns domain behavior:

- stores recent events in memory for fast reads after loading from SQLite.
- reduces each event into an `AgentRecord`.
- tracks event/error/warning/alert counts per agent.
- derives task records from task lifecycle events and status payloads.
- marks active agents offline after a timeout without events.
- captures assistant conclusions.
- evaluates trigger rules and creates alerts.
- persists changed records through `HarnessDatabase`.

## Database responsibilities

`src/db.ts` wraps `better-sqlite3` and stores local persistent state.

Default database path:

```text
.harness/harness.db
```

Override with:

```bash
HARNESS_DB_PATH=/path/to/harness.db
```

The app still keeps capped in-memory arrays for fast response and SSE use, but records are loaded from SQLite on server start.

Current caps in `HarnessStore`:

- events: 1000 recent events in memory
- alerts: 500 recent alerts in memory
- conclusions: 500 recent conclusions in memory

## Client responsibilities

`src/web/main.tsx` currently handles:

- initial REST load from `/dashboard`, `/agents`, `/tasks`, and `/events?limit=200`.
- SSE subscription to `/stream`.
- local UI state for cards/table view, filters, live/pause display, sparklines, selected detail agent, and inline rename.
- rendering Fleet Control cards/table.
- rendering the agent detail view.

The web app currently hardcodes:

```ts
const apiBase = "http://localhost:4000";
```

## Realtime model

The server exposes:

```http
GET /stream
```

SSE frames currently include:

- `connected`
- `event.created`
- `conclusion.created`
- `alert.created`
- `alert.updated`
- `agent.updated`
- `agents.updated`
- `tasks.updated`
- `dashboard.updated`
- `rule.updated`

SSE was chosen because the dashboard currently needs server-to-client updates. Control actions such as rename still use REST.

## Producer model

Any producer can send events if it follows `documents/event-envelope.md`.

Implemented producers:

- Pi extension: `.pi/extensions/harness-reporter.ts`
- Claude Code hook: `adapters/claude-code-hook.mjs`
- shell simulation scripts in the project root

Pi can be installed globally with:

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000
```

## Generated/runtime outputs

- `dist-server/` — server build output.
- `dist/` — Vite web build output.
- `.harness/` — local database, outbox, and optional producer config.
