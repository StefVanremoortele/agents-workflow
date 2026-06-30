# Agent Lifecycle and Active Agent State

The server derives active agent state from incoming events.

## Status values

```ts
type AgentStatus =
  | "starting"
  | "idle"
  | "working"
  | "blocked"
  | "waiting_for_input"
  | "error"
  | "stopping"
  | "offline";
```

## Lifecycle events

Important lifecycle event types:

- `agent.status`
- `agent.heartbeat`
- `agent.task.started`
- `agent.task.updated`
- `agent.task.completed`
- `agent.task.blocked`
- `agent.stopped`

## Example working status

```json
{
  "schemaVersion": "1",
  "source": {
    "id": "pi-local",
    "type": "agent",
    "name": "Pi Agent"
  },
  "event": {
    "type": "agent.status",
    "title": "Agent is working",
    "severity": "info",
    "payload": {
      "status": "working",
      "task": "Implementing auth refactor"
    }
  }
}
```

## Active working count

The dashboard counts these statuses as active/working:

- `starting`
- `working`
- `blocked`
- `waiting_for_input`
- `error`

These are not counted as active:

- `idle`
- `stopping`
- `offline`

## Offline detection

The server marks an agent as `offline` when it has not seen an event from that agent for more than the timeout.

Current timeout:

```ts
30_000 milliseconds
```

## Agent record shape

```ts
type AgentRecord = {
  id: string;
  type: SourceType;
  name?: string;
  adapter?: string;
  status: AgentStatus;
  project?: ProjectInfo;
  host?: EventSource["host"];
  currentTask?: {
    id?: string;
    title?: string;
    summary?: string;
    startedAt?: string;
    updatedAt?: string;
  };
  stats: {
    eventCount: number;
    alertCount: number;
    errorCount: number;
    warningCount: number;
  };
  timestamps: {
    firstSeenAt: string;
    lastSeenAt: string;
    lastStatusChangeAt?: string;
    lastHeartbeatAt?: string;
  };
  lastEvent?: {
    id: string;
    type: string;
    title?: string;
    content?: string;
    severity?: Severity;
    timestamp: string;
  };
};
```
