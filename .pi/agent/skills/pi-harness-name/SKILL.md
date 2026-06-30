---
name: pi-harness-name
description: Change the Pi harness display name in this project's agent dashboard and send a refresh event to the harness webapp. Use when the user asks to rename Pi Agent, change the Pi harness/source name, or update how Pi appears in the harness web UI.
---

# Pi Harness Name

Use this skill to rename how the current Pi coding-agent appears in the project harness webapp.

## What it does

The project script `scripts/set-pi-harness-name.mjs`:

1. Resolves the harness server URL from `HARNESS_SERVER_URL` or defaults to `http://localhost:4000`.
2. Finds the current Pi source id from `HARNESS_SOURCE_ID`, or from the harness `/agents` list for the current working directory, or falls back to `pi:<cwd>`.
3. Writes `.harness/pi-harness.json` with the chosen `sourceId` and new `sourceName`.
4. Calls `PUT /agents/:id` when the agent already exists.
5. Sends an `agent.status` event named `Pi harness name updated` so the webapp receives SSE updates immediately.

The Pi extension `.pi/extensions/harness-reporter.ts` reads `.harness/pi-harness.json` on each event, so future events keep the updated name.

## Usage

When asked to rename the Pi harness, run:

```bash
npm run pi:harness:name -- "New Harness Name"
```

or directly:

```bash
node scripts/set-pi-harness-name.mjs "New Harness Name"
```

## Examples

```bash
npm run pi:harness:name -- "Pi Harness"
npm run pi:harness:name -- "Stef's Pi Agent"
npm run pi:harness:name -- "Review Bot"
```

## Notes

- This is separate from the Pi session name (`/name <name>` or `pi --name "..."`).
- If the harness server is not running, start it first with `npm run dev:server` or `npm run dev`.
- If you need to target a non-default server, set `HARNESS_SERVER_URL`, for example:

```bash
HARNESS_SERVER_URL="http://localhost:4000" npm run pi:harness:name -- "Pi Harness"
```
