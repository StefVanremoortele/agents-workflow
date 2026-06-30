# Agent Harness Documentation

This folder documents the current agent-agnostic development-control harness.

## Start here

If you are an agent or developer entering with no prior context, read these first:

1. [Start Here](./START_HERE.md)
2. [Project Map](./project-map.md)
3. [Architecture](./architecture.md)
4. [API Reference](./api-reference.md)
5. [Dashboard](./dashboard.md)

The root `AGENTS.md` repeats the critical onboarding path for coding agents.

## What is implemented

A central observability/control foundation for agentic software-development workflows:

- structured event intake server
- local SQLite persistence
- active agent registry
- lifecycle/status/task reduction
- realtime updates via Server-Sent Events
- trigger/rule engine and alert records
- conclusion capture from assistant messages
- React Fleet Control dashboard
- agent cards and dense table views
- per-agent detail view with task progress, metadata, throughput, and activity log
- inline agent rename
- pi producer adapter extension, including global installer for all pi environments
- Claude Code hook producer adapter with offline outbox support

## Main components

| Component | Path | Purpose |
|---|---|---|
| Server entrypoint | `src/server.ts` | HTTP API, CORS, SSE, route handling, outbox import |
| Store/reducer | `src/store.ts` | Events, agents, tasks, rules, alerts, conclusions, derived dashboard state |
| SQLite database | `src/db.ts` | Persistent storage and schema management |
| Shared types | `src/types.ts` | Event, agent, task, alert, rule, dashboard type definitions |
| React dashboard | `src/web/` | Modular Fleet UI: `app/`, `store/` (Zustand), `api/`, `hooks/`, `lib/`, `components/`. Entry `main.tsx` → `app/App.tsx` |
| Dashboard styles | `src/web/styles.css` | Fleet Control aesthetic and responsive layout |
| Pi adapter | `.pi/extensions/harness-reporter.ts` | Emits pi events to the harness server |
| Pi global installer | `scripts/install-pi-harness-extension.mjs` | Installs the Pi adapter globally |
| Claude Code adapter | `adapters/claude-code-hook.mjs` | Emits Claude Code hook events |

## Documentation index

- [Start Here](./START_HERE.md)
- [Project Map](./project-map.md)
- [Architecture](./architecture.md)
- [Event Envelope](./event-envelope.md)
- [Agent Lifecycle](./agent-lifecycle.md)
- [API Reference](./api-reference.md)
- [Dashboard](./dashboard.md)
- [Alerts and Rules](./alerts-and-rules.md)
- [Pi Producer Adapter](./pi-producer-adapter.md)
- [Claude Code Producer Adapter](./claude-code-producer-adapter.md)
- [Running the Project](./running.md)
- [Next Steps](./next-steps.md)
