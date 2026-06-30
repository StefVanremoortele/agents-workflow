# React Dashboard: Fleet Control

The dashboard is a React/Vite single-page client with a modular architecture under `src/web/`. State lives in a Zustand store; components are presentational and read from it via selectors.

## Layout

```text
src/web/
  main.tsx                 Thin entry: mounts <App />
  app/App.tsx              Root: hooks + fleet/detail view switch
  config.ts                apiBase (VITE_API_BASE), cache key, history lengths
  store/fleetStore.ts      Zustand store: server + UI state and actions
  api/client.ts            REST client (dashboard/agents/tasks/events/conclusions, rename)
  api/stream.ts            SSE wiring (createEventStream)
  hooks/                   useBootstrap, useEventStream, useClock, useFleetAgents
  lib/                     derive, history, format, logEvents, cache, markdown
  components/common/       StatusPill, Sparkline
  components/fleet/        FleetDashboard, Kpi, FilterChip, AgentCard, AgentTable, Progress, WaitingBanner
  components/detail/       AgentDetailView, zen overlays, ActivityLogRow, DetailMetric, DetailRow
  types/view.ts            Web view types; re-exports backend records from src/types.ts
  styles.css               Fleet Control visual system
```

Imports within the app use the `@/` alias (configured in `vite.config.ts` and `tsconfig.web.json`), e.g. `@/store/fleetStore`.

## Purpose

Fleet Control is the visual client for the harness server. It shows which agents exist, what they are doing, their recent activity, and per-agent detail.

## Current UI

The dashboard provides:

- live fleet KPI strip
- global throughput panel and sparkline
- live/pause UI toggle
- cards view
- dense table view
- status filters, with offline agents hidden by default until the Offline chip is enabled
- refresh button
- inline agent rename
- agent detail view
- per-agent task/progress display
- per-agent activity log from recent events
- server connection status

Alert and rule APIs still exist on the server, but the current Fleet Control UI focuses on fleet and agent detail views rather than exposing a full alerts/rules management panel.

## Data loading

On startup and refresh, the dashboard fetches:

- `GET /dashboard`
- `GET /agents`
- `GET /tasks`
- `GET /events?limit=200`

A small snapshot cache is kept in `localStorage` under:

```text
harness.fleet.snapshot
```

## Realtime updates

The dashboard opens:

```text
GET http://localhost:4000/stream
```

It listens for:

- `event.created` — prepends to local activity log and updates throughput tick.
- `agent.updated` — updates one agent.
- `agents.updated` — replaces full agent list.
- `tasks.updated` — replaces task list.
- `dashboard.updated` — replaces dashboard summary.

## Fleet cards

Cards include:

- status dot and status pill
- agent display name
- rename button
- inferred model/adapter
- project name
- current task
- working progress bar
- waiting banner when waiting for input
- elapsed and ETA
- activity event count
- per-agent sparkline

Cards are clickable and open the agent detail view. Rename controls stop propagation so they do not open details accidentally.

## Table view

Table rows show:

- agent name and rename button
- status pill
- current task
- progress
- elapsed
- ETA
- activity sparkline
- event count

Rows are clickable and open the agent detail view.

## Agent detail view

The detail view is implemented to match the design references:

- `documents/design/design_handoff_fleet_control/screenshots/detail-view.png`
- `documents/design/design_handoff_fleet_control/screenshots/detail-view-log.png`

It includes:

- back button to Fleet Control
- carousel controls to navigate previous/next agent sessions, including Left/Right arrow-key support
- pause/stop/respond placeholder buttons
- hero row with status dot, name, and status pill
- metadata line with model, project, repository, and short agent id
- metric tiles: elapsed, ETA, progress, events
- current task panel with progress and checklist
- throughput sparkline panel
- details sidebar with model/project/repository/agent id/started/uptime
- latest conclusion panel showing the final assistant response captured at task completion
- activity log sourced from recent events for that agent, including conclusion/content previews

Some task checklist steps are inferred client-side from current progress because the event protocol does not yet provide detailed step records.

## State management

`store/fleetStore.ts` is a single Zustand store holding all server state (dashboard, agents, tasks, events, conclusions, sparkline histories) and UI state (view, filters, live/pause, selected agent, detail carousel). Actions on the store handle REST refresh, SSE updates, rename, and navigation. The `hooks/` layer connects the store to the runtime: `useBootstrap` hydrates from cache then refreshes, `useEventStream` routes `/stream` frames into store actions, and `useClock` drives the header clock and throughput window.

## State derivation in the client

`useFleetAgents` (backed by `lib/derive.ts`'s `toFleetAgent`) converts server `AgentRecord` + `AgentTaskRecord[]` into UI-friendly `FleetAgent` records.

The client infers:

- display state (`working`, `waiting`, `idle`, `offline`) from server status
- model name from adapter/name
- project name from event project metadata
- progress/step/ETA where explicit task progress is not available
- sparklines from event-count deltas over time

## Styling

`src/web/styles.css` implements the warm dark Fleet Control design:

- Space Grotesk for UI/display text
- JetBrains Mono for labels and metrics
- amber working/accent color
- coral waiting color
- rounded cards/panels
- sparklines
- status glow/pulse
- responsive card/table/detail layouts

## Known limitations

- `apiBase` defaults to `http://localhost:4000`; override at build time with `VITE_API_BASE` (see `src/web/config.ts`).
- Pause/Stop/Respond buttons are visual placeholders; no control API is implemented yet.
- Detail task steps are inferred rather than stored as first-class backend records.
- Alerts/rules are available via API but are not surfaced in the current Fleet Control UI.
