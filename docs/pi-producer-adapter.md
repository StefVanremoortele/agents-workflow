# Pi Producer Adapter

This project includes a pi extension that forwards structured agent events to the harness server.

## Location

Project-local source:

```text
.pi/extensions/harness-reporter.ts
```

Install it globally for every pi project/environment:

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000
```

This copies the extension to:

```text
~/.pi/agent/extensions/harness-reporter.ts
```

Restart pi, or run `/reload` in an active pi session, after installing.

## Configuration

Optional environment variables:

```bash
export HARNESS_SERVER_URL=http://localhost:4000
export HARNESS_SOURCE_ID=pi-main
```

Optional config files:

- `~/.pi/agent/harness-reporter.json` — global defaults used in every pi environment.
- `<project>/.harness/pi-harness.json` — project-specific overrides.
- `PI_HARNESS_CONFIG=/path/to/config.json` — explicit override file.

Supported config fields are `serverUrl`, `sourceId`, and `sourceName`. Environment variables override config files.

The extension appends a stable hash of the pi session file plus the pi process id to the base source id, so each running pi session/process appears as a separate harness agent while events within that process stay grouped together.

## Events emitted

- `agent.status` on session start, agent start, and agent end
- `tool.call` before tool execution
- `tool.result` after tool execution
- `agent.stopped` on session shutdown

## Usage

1. Start the harness server:

```bash
npm run dev:server
```

2. Start the dashboard:

```bash
npm run dev:web
```

3. Install the extension globally once:

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000
```

4. Start pi from any project:

```bash
pi
```

5. Agent activity should appear in the React dashboard.

The extension is intentionally best-effort: if the server is offline, it silently skips reporting so pi remains usable.
