# Pi Producer Adapter

The Pi producer adapter is a Pi extension that forwards pi session, agent, and tool activity to the harness server.

## Paths

Project-local source:

```text
.pi/extensions/harness-reporter.ts
```

Global install target:

```text
~/.pi/agent/extensions/harness-reporter.ts
```

Global config file:

```text
~/.pi/agent/harness-reporter.json
```

Project config file:

```text
.harness/pi-harness.json
```

## Purpose

The adapter turns pi into one producer for the agent-agnostic harness server. It reports structured events using the same event envelope as any other producer.

## Global installation

Install once from this project:

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000
```

This copies `.pi/extensions/harness-reporter.ts` to `~/.pi/agent/extensions/harness-reporter.ts` so pi loads it in any environment.

After installing:

- restart pi, or
- run `/reload` in an active pi session.

Optional installer flags:

```bash
npm run pi:harness:install-global -- --server-url http://localhost:4000 --source-name "Pi Agent"
```

## Configuration precedence

The extension merges configuration in this order:

1. global config: `~/.pi/agent/harness-reporter.json`
2. project config: `<cwd>/.harness/pi-harness.json`
3. explicit config: `PI_HARNESS_CONFIG=/path/to/config.json`
4. environment variables override all config files

Supported config fields:

```json
{
  "serverUrl": "http://localhost:4000",
  "sourceId": "pi-main",
  "sourceName": "Pi Agent"
}
```

Optional environment variables:

```bash
export HARNESS_SERVER_URL=http://localhost:4000
export HARNESS_SOURCE_ID=pi-main
export HARNESS_SOURCE_NAME="Pi Agent"
export PI_HARNESS_CONFIG=/path/to/config.json
```

Defaults:

- `HARNESS_SERVER_URL` / `serverUrl`: `http://localhost:4000`
- base source id: `HARNESS_SOURCE_ID`, config `sourceId`, or `pi:<cwd>`
- display name: `HARNESS_SOURCE_NAME`, config `sourceName`, or `Pi Agent`
- effective source id: `<base>:session:<session-and-process-hash>`

The session/process suffix makes each running pi session/process appear as a separate harness agent while keeping events within that process grouped together.

## Events emitted

### Task progress telemetry

The reporter now emits real structured task progress. It does not parse assistant prose or fabricate implementation checklists.

Progress can come from two sources:

- `pi-lifecycle`: automatic coarse lifecycle phases from Pi hooks.
- `producer-reported`: explicit semantic progress reported through the optional `harness_progress` tool.

Task event payloads may include:

```json
{
  "taskId": "123-task",
  "task": "Implement dashboard change",
  "progress": 40,
  "progressSource": "pi-lifecycle",
  "step": 2,
  "totalSteps": 5,
  "steps": [
    { "id": "lifecycle:1", "label": "Receive user task", "status": "completed" },
    { "id": "lifecycle:2", "label": "Start agent loop", "status": "running" }
  ]
}
```

Automatic lifecycle steps are:

1. Receive user task
2. Start agent loop
3. Run tool calls
4. Produce assistant response
5. Complete task

Tool calls/results add real tool-level steps such as `Read file`, `Edit file`, or `Run shell command`.

### Optional `harness_progress` tool

The extension registers a `harness_progress` tool. The model may call it to report explicit dashboard progress:

```json
{
  "progress": 50,
  "steps": [
    { "label": "Inspect current implementation", "status": "completed" },
    { "label": "Update reporter telemetry", "status": "running" }
  ]
}
```

The injected system prompt guidance tells the model to use this only for real task state, not speculative plans.

### Session start

Sends `agent.status` with `payload.status = "idle"`.

### Before agent start

Sends `agent.task.started` with the user prompt as task content, a task id, and initial lifecycle progress. Also injects a short system prompt hint describing the optional `harness_progress` tool.

### Agent start

Sends `agent.task.updated` to mark the agent loop started, then sends `agent.status` with `payload.status = "working"`.

### Agent end

The extension remembers the latest finalized assistant message for the turn. When the agent ends, it sends:

1. `message.assistant` with `content` and `conclusion` set to the final assistant response, when available
2. `agent.task.completed` with final lifecycle/tool progress
3. `agent.status` with `payload.status = "idle"`

The final response is only attached to `message.assistant` so the Activity Log does not show duplicate conclusion entries.

### Tool call

Sends `agent.task.updated` with a running tool step, then sends `tool.call` with:

- tool name
- tool input
- current task id

### Tool result

Sends `agent.task.updated` marking the matching tool step completed or failed, then sends `tool.result` with:

- tool name
- text content truncated to 8000 characters
- error status
- original input
- current task id

If the tool result is an error, severity is `error`; otherwise severity is `info`.

### Session shutdown

Sends `agent.stopped` with `payload.status = "offline"`.

## Usage

Start server:

```bash
npm run dev:server
```

Start dashboard:

```bash
npm run dev:web
```

Start pi in any project after global install:

```bash
pi
```

## Renaming Pi in the dashboard

Project-specific display name:

```bash
npm run pi:harness:name -- "New Harness Name"
```

This writes `.harness/pi-harness.json`, updates the server when possible, and sends a refresh event.

## Duplicate-load protection

The extension has a process-wide singleton guard. If both the global extension and a project-local copy are discovered by pi in the same process, only the first loaded copy subscribes to lifecycle events.

## Failure behavior

The extension is best-effort. If the harness server is offline or unreachable, it silently skips reporting so pi remains usable.
