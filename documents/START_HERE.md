# Start Here: Agent Harness

## What this project is

Agent Harness is a local observability/control dashboard for agentic development workflows. It receives structured events from coding agents and related tools, persists recent state, reduces events into live agent/task records, evaluates trigger rules, and streams updates to a React dashboard.

The current UI is **Fleet Control**: a real-time fleet overview with cards/table views and a per-agent detail page.

## Current capabilities

- HTTP event intake at `POST /events`.
- Persistent local SQLite storage for events, agents, tasks, alerts, conclusions, and rules.
- Agent lifecycle reduction from `agent.status`, `agent.heartbeat`, `agent.task.*`, `agent.stopped`, tool events, and message events.
- Derived task records and current task display.
- Trigger rules that create alerts from event content/conclusions/severity.
- Server-Sent Events (`GET /stream`) for live browser updates.
- React/Vite Fleet Control web app:
  - KPI strip and throughput sparkline.
  - Cards/table views with status filters.
  - Inline agent rename.
  - Agent detail view with task progress, checklist, throughput, metadata, final conclusion, and activity log.
- Pi producer extension:
  - Project-local extension at `.pi/extensions/harness-reporter.ts`.
  - Global installer to make it run in every pi environment.
- Claude Code hook adapter at `adapters/claude-code-hook.mjs`.
- Offline outbox import for producer events that could not reach the server.

## Quick run

```bash
npm install
npm run dev
```

Open:

- Server health: `http://localhost:4000/health`
- Web app: `http://localhost:5173`

Build:

```bash
npm run build
```

Clear local harness data while keeping the SQLite schema:

```bash
npm run db:clear
```

## Install Pi reporting globally

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000
```

This copies the harness reporter extension to `~/.pi/agent/extensions/harness-reporter.ts` and writes optional global config to `~/.pi/agent/harness-reporter.json`. Restart pi or run `/reload` after installing.

## Where state lives

Default runtime files are under `.harness/`:

- `.harness/harness.db` — SQLite database.
- `.harness/outbox.jsonl` — queued events from adapters when the server was offline.
- `.harness/pi-harness.json` — optional project-specific Pi source config.

Environment overrides:

- `PORT` — server port, default `4000`.
- `HARNESS_DB_PATH` — SQLite path, default `.harness/harness.db`.
- `HARNESS_OUTBOX_PATH` — outbox path, default `.harness/outbox.jsonl`.
- `HARNESS_SERVER_URL` — producer target URL, default `http://localhost:4000`.

## Main files to inspect

- `src/server.ts` — routes, validation, SSE.
- `src/store.ts` — event reduction, rules, derived dashboard state.
- `src/db.ts` — SQLite schema and persistence.
- `src/types.ts` — shared domain types (re-exported by the web app).
- `src/web/main.tsx` — thin React entry that mounts `app/App.tsx`.
- `src/web/store/fleetStore.ts` — Zustand store: client state and actions.
- `src/web/api/` — REST and SSE clients.
- `src/web/components/` — fleet and detail view components.
- `src/web/styles.css` — visual design.
- See `documents/dashboard.md` for the full web app layout.
- `.pi/extensions/harness-reporter.ts` — Pi extension producer.
- `scripts/install-pi-harness-extension.mjs` — global Pi installer.

## Documentation map

- `documents/project-map.md` — file-by-file guide.
- `documents/architecture.md` — data flow and responsibilities.
- `documents/api-reference.md` — REST/SSE API.
- `documents/dashboard.md` — web app details.
- `documents/event-envelope.md` — event shape producers must send.
- `documents/agent-lifecycle.md` — status/task lifecycle.
- `documents/pi-producer-adapter.md` — Pi integration.
- `documents/claude-code-producer-adapter.md` — Claude Code hook integration.
- `documents/running.md` — operational runbook.
