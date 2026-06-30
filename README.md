# Agent Harness

Local observability/control dashboard for agentic development workflows.

## Start here

- Coding agents: read [`AGENTS.md`](./AGENTS.md).
- Full project overview: read [`documents/START_HERE.md`](./documents/START_HERE.md).
- File guide: read [`documents/project-map.md`](./documents/project-map.md).

## Quick run

```bash
npm install
npm run dev
```

Open:

- Server: `http://localhost:4000`
- Web dashboard: `http://localhost:5173`

## What is implemented

- Node HTTP event intake server.
- SQLite persistence under `.harness/harness.db` by default.
- Agent/task/alert/conclusion reduction.
- Server-Sent Events stream.
- React Fleet Control dashboard with cards/table views and agent detail view.
- Pi extension producer with global installer.
- Claude Code hook producer.

## Documentation

See [`documents/README.md`](./documents/README.md) for the documentation index.
