# Agent Onboarding

Start here when you have an empty context and need to understand or modify this project.

## Read order

1. `documents/START_HERE.md` — project purpose, current capabilities, run/test commands.
2. `documents/project-map.md` — important files and where to make changes.
3. `documents/architecture.md` — server/store/database/SSE data flow.
4. `documents/api-reference.md` — HTTP and SSE contract.
5. `documents/dashboard.md` — React fleet UI and detail view behavior.
6. Producer docs as needed:
   - `documents/pi-producer-adapter.md`
   - `documents/claude-code-producer-adapter.md`

## Common commands

```bash
npm install
npm run dev              # server + Vite web app
npm run dev:server       # server only, http://localhost:4000
npm run dev:web          # web only, usually http://localhost:5173
npm run build            # TypeScript server + Vite web build
npm run db:clear         # clear local SQLite harness data while keeping schema
npm run db:reset         # reset local SQLite harness DB files
npm run pi:harness:install-global -- --server-url http://localhost:4000
```

## High-level architecture

- Producers POST structured events to `POST /events`.
- `src/server.ts` validates/routes requests and broadcasts Server-Sent Events.
- `src/store.ts` reduces events into agents/tasks/alerts/conclusions and persists through `src/db.ts`.
- The React app in `src/web/main.tsx` loads REST snapshots and listens to `/stream`.
- Styling is centralized in `src/web/styles.css`.

## Important implementation notes

- This workspace may not be a git repository; check `git status` before assuming git is available.
- Generated outputs are `dist/` and `dist-server/`.
- Local runtime state lives under `.harness/` by default.
- The web app currently hardcodes `http://localhost:4000` as `apiBase`.
- Pi global reporting is installed by copying `.pi/extensions/harness-reporter.ts` to `~/.pi/agent/extensions/harness-reporter.ts`.
