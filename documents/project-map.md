# Project Map

Use this as the quickest way to find the right file for a change.

## Runtime entry points

| Path | Purpose |
|---|---|
| `src/server.ts` | Node HTTP server, all routes, JSON validation, SSE broadcasting, outbox import on startup. |
| `src/store.ts` | Domain reducer: events → agents/tasks/conclusions/alerts/dashboard summary. |
| `src/db.ts` | SQLite persistence layer, schema initialization, serialization/deserialization. |
| `src/types.ts` | Shared TypeScript domain types for events, agents, tasks, alerts, rules, dashboard. The web app re-exports these as its source of truth. |
| `src/web/main.tsx` | Thin React entry: mounts `<App />`. |
| `src/web/styles.css` | Fleet Control visual system and responsive layout. |
| `index.html` | Vite HTML entry. |
| `vite.config.ts` | Vite build config: React plugin, `@` → `src/web` alias, `dist/` output. |
| `tsconfig.web.json` | Web typecheck config (DOM/JSX libs, `@/*` paths). Run via `npm run typecheck:web`. |

## Web app layout (`src/web/`)

The Fleet Control SPA is modular. Import within the app using the `@/` alias (e.g. `@/store/fleetStore`).

| Path | Purpose |
|---|---|
| `app/App.tsx` | Root component: wires bootstrap/stream/clock hooks and switches between fleet and detail views. |
| `store/fleetStore.ts` | Zustand store: all server + UI state and actions (replaces the old root `useState` cluster). |
| `api/client.ts` | REST client (`fetchDashboard/Agents/Tasks/Events/Conclusions`, `renameAgent`, `loadFleet`). |
| `api/stream.ts` | SSE wiring (`createEventStream`) mapping `/stream` frames to handlers. |
| `hooks/` | `useBootstrap`, `useEventStream`, `useClock`, `useFleetAgents` (derives `FleetAgent[]`). |
| `lib/` | Pure helpers: `derive` (state/model/progress inference), `history`, `format`, `logEvents`, `cache`, `markdown`. |
| `components/common/` | Shared `StatusPill`, `Sparkline`. |
| `components/fleet/` | `FleetDashboard`, `Kpi`, `FilterChip`, `AgentCard`, `AgentTable`, `Progress`, `WaitingBanner`. |
| `components/detail/` | `AgentDetailView`, zen overlays, `ActivityLogRow`, `DetailMetric`, `DetailRow`. |
| `types/view.ts` | Web view types (`FleetAgent`, `FleetState`, `ViewMode`, `HarnessEventRecord`); re-exports backend records from `src/types.ts`. |
| `config.ts` | `apiBase` (overridable via `VITE_API_BASE`), cache key, history lengths, empty dashboard. |

## Producers and integrations

| Path | Purpose |
|---|---|
| `.pi/extensions/harness-reporter.ts` | Pi extension that reports session, task, and tool events. Can be project-local or installed globally. |
| `scripts/install-pi-harness-extension.mjs` | Copies the Pi extension to `~/.pi/agent/extensions/` and optionally writes global config. |
| `scripts/set-pi-harness-name.mjs` | Sets/updates the display name for a Pi harness source. |
| `scripts/reload-source-name.mjs` | Sends a one-off status event to refresh a source name. |
| `scripts/db-clear.mjs` | Clears harness SQLite tables without deleting the database file. |
| `adapters/claude-code-hook.mjs` | Claude Code hook producer; maps hooks to harness events and queues offline outbox entries. |
| `.claude/settings.json` | Project-local Claude Code hook configuration pointing at the adapter. |

## Database and runtime artifacts

| Path | Purpose |
|---|---|
| `.harness/harness.db` | Default SQLite database. |
| `.harness/outbox.jsonl` | Default queued producer events for later server import. |
| `.harness/pi-harness.json` | Optional project Pi source config. |
| `dist-server/` | Generated server build output. |
| `dist/` | Generated web build output. |
| `node_modules/` | Installed npm dependencies. |

## Documentation

| Path | Purpose |
|---|---|
| `AGENTS.md` | Root-level onboarding instructions for coding agents. |
| `documents/START_HERE.md` | Human/agent project overview and run commands. |
| `documents/architecture.md` | Current data flow and component responsibilities. |
| `documents/api-reference.md` | HTTP and SSE API. |
| `documents/dashboard.md` | Fleet Control UI behavior. |
| `documents/event-envelope.md` | Producer event envelope format. |
| `documents/agent-lifecycle.md` | Agent status and task lifecycle. |
| `documents/running.md` | Operational runbook. |

## Common change locations

- Add or change an API endpoint: `src/server.ts`, then update `documents/api-reference.md`.
- Change agent/task state derivation: `src/store.ts`, then update `documents/agent-lifecycle.md`.
- Change persisted data shape: `src/types.ts` and `src/db.ts` together.
- Change Fleet Control data flow (REST/SSE/state): `src/web/store/fleetStore.ts`, `src/web/api/`, `src/web/hooks/`.
- Change a Fleet Control view or component: the relevant file under `src/web/components/`.
- Change agent state/model/progress derivation in the client: `src/web/lib/derive.ts`.
- Change Fleet Control styling: `src/web/styles.css`.
- Change the API base URL: set `VITE_API_BASE`, or edit the default in `src/web/config.ts`.
- Change Pi event reporting: `.pi/extensions/harness-reporter.ts`, then run/install globally if desired.
- Change Claude Code reporting: `adapters/claude-code-hook.mjs` and possibly `.claude/settings.json`.
