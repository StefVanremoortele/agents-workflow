# Agent-Agnostic Event Envelope

The harness server accepts structured events from any producer.

A producer can be:

- coding agent
- script
- CI job
- human tool
- background service
- unknown/custom integration

## Required minimum shape

```json
{
  "schemaVersion": "1",
  "source": {
    "id": "agent-1",
    "type": "agent"
  },
  "event": {
    "type": "agent.status"
  }
}
```

## Full shape

```ts
type HarnessEventInput = {
  schemaVersion: "1";
  id?: string;
  timestamp?: string;
  source: EventSource;
  event: EventBody;
  context?: EventContext;
};
```

## Source

```ts
type EventSource = {
  id: string;
  type: "agent" | "script" | "ci" | "human" | "service" | "unknown";
  name?: string;
  adapter?: string;
  llm?: {
    provider?: string;
    id?: string;
    name?: string;
    reasoningLevel?: string;
  };
  project?: {
    id?: string;
    name?: string;
    path?: string;
    repository?: string;
    branch?: string;
  };
  host?: {
    hostname?: string;
    user?: string;
    cwd?: string;
  };
};
```

## Event body

```ts
type EventBody = {
  type: string;
  title?: string;
  content?: string;
  severity?: "debug" | "info" | "notice" | "warning" | "error" | "critical";
  tags?: string[];
  conclusion?: string;
  payload?: Record<string, unknown>;
};
```

## Context

```ts
type EventContext = {
  sessionId?: string;
  taskId?: string;
  parentEventId?: string;
  correlationId?: string;
  visibility?: "private" | "project" | "global";
  ttlSeconds?: number;
};
```

## Example: tool result

```json
{
  "schemaVersion": "1",
  "source": {
    "id": "pi-local",
    "type": "agent",
    "name": "Pi Agent",
    "adapter": "pi-extension",
    "project": {
      "name": "agent-harness",
      "path": "/home/user/project"
    }
  },
  "event": {
    "type": "tool.result",
    "title": "Tool result: bash",
    "content": "npm test failed with 2 failures",
    "severity": "error",
    "tags": ["pi", "tool", "bash"],
    "conclusion": "Tool returned an error",
    "payload": {
      "tool": "bash",
      "isError": true
    }
  },
  "context": {
    "visibility": "project"
  }
}
```

## Task progress payload fields

For `agent.task.started`, `agent.task.updated`, `agent.task.completed`, and `agent.task.blocked`, producers may report real progress fields in `event.payload`:

```json
{
  "taskId": "task-123",
  "task": "Implement feature",
  "progress": 40,
  "progressSource": "pi-lifecycle",
  "step": 2,
  "totalSteps": 5,
  "steps": [
    { "label": "Read files", "status": "completed" },
    { "label": "Apply changes", "status": "running" }
  ]
}
```

Step statuses are `todo`, `running`, `completed`, `blocked`, or `failed`. `progressSource` is optional but recommended when progress is derived from producer lifecycle telemetry rather than an explicit semantic checklist.

If these fields are omitted, the dashboard shows progress as unavailable instead of fabricating mock steps.

## Core event types considered so far

- `agent.status`
- `agent.heartbeat`
- `agent.stopped`
- `agent.task.started`
- `agent.task.updated`
- `agent.task.completed`
- `agent.task.blocked`
- `message.user`
- `message.assistant`
- `tool.call`
- `tool.result`
- `command.started`
- `command.finished`
- `file.changed`
- `alert.candidate`
