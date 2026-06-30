# Running the Project

## Install dependencies

```bash
npm install
```

## Run server and web dashboard together

```bash
npm run dev
```

This runs:

- server: `npm run dev:server`
- web dashboard: `npm run dev:web`

## Run separately

Server:

```bash
npm run dev:server
```

Dashboard:

```bash
npm run dev:web
```

## URLs

Server:

```text
http://localhost:4000
```

Dashboard:

```text
http://localhost:5173
```

Vite may choose another port if `5173` is unavailable.

## Persistent database

Harness data is stored in a local SQLite database and reloaded when the server starts. The default path is:

```text
.harness/harness.db
```

Override it with:

```bash
export HARNESS_DB_PATH=/path/to/harness.db
```

Initialize, clear, or reset the database during development:

```bash
npm run db:init       # create schema if needed
npm run db:clear      # delete all rows while keeping the database file/schema
npm run db:clear -- --keep-rules  # keep trigger rules while clearing runtime data
npm run db:reset      # remove the SQLite database files entirely
```

If an adapter cannot reach the server, it appends events to `.harness/outbox.jsonl` by default. On the next server start, the server imports that outbox into SQLite and archives it after a successful import. Override the path with `HARNESS_OUTBOX_PATH`.

## Install Pi reporting globally

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000
```

This installs the Pi reporter into `~/.pi/agent/extensions/harness-reporter.ts` so pi sessions from any project report to the running harness server. Restart pi or run `/reload` after installing.

Optional:

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000 --source-name "Pi Agent"
```

## Build

```bash
npm run build
```

This creates:

- `dist-server/` for the TypeScript server build
- `dist/` for the Vite web build

## Typecheck the web app

The web app is type-checked separately from the server build:

```bash
npm run typecheck:web
```

## Start built server

```bash
npm run start:server
```

## Smoke test

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "ok": true,
  "service": "harness-server",
  "version": "0.1.0"
}
```

## Submit a demo event

```bash
curl -X POST http://localhost:4000/events \
  -H 'Content-Type: application/json' \
  -d '{
    "schemaVersion": "1",
    "source": {
      "id": "demo-agent",
      "type": "agent",
      "name": "Demo Agent",
      "project": { "name": "agent-harness" }
    },
    "event": {
      "type": "agent.status",
      "title": "Demo agent working",
      "severity": "info",
      "payload": {
        "status": "working",
        "task": "Testing the harness"
      }
    }
  }'
```

## Submit an event that creates an alert

```bash
curl -X POST http://localhost:4000/events \
  -H 'Content-Type: application/json' \
  -d '{
    "schemaVersion": "1",
    "source": {
      "id": "demo-agent",
      "type": "agent",
      "name": "Demo Agent"
    },
    "event": {
      "type": "tool.result",
      "severity": "error",
      "content": "npm test failed with 2 failures"
    }
  }'
```

Then check:

```bash
curl http://localhost:4000/alerts
```
