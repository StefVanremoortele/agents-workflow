# API Reference

Default server base URL:

```text
http://localhost:4000
```

All JSON responses include permissive CORS headers.

## Health

```http
GET /health
```

Response:

```json
{
  "ok": true,
  "service": "harness-server",
  "version": "0.1.0"
}
```

## Submit event

```http
POST /events
Content-Type: application/json
```

Request body follows the event envelope described in `event-envelope.md`.

Response:

```json
{
  "accepted": true,
  "eventId": "evt_...",
  "alertsCreated": 1
}
```

Side effects:

- event is persisted
- agent/task state is reduced
- conclusions may be captured
- rules may create alerts
- SSE updates are broadcast

## Dashboard summary

```http
GET /dashboard
```

Response shape:

```json
{
  "agentsTotal": 1,
  "agentsWorking": 1,
  "agentsIdle": 0,
  "agentsBlocked": 0,
  "agentsOffline": 0,
  "projectsActive": 1,
  "alertsUnacknowledged": 0,
  "alertsCritical": 0,
  "recentEventCount": 10,
  "runningTasks": 1,
  "recentConclusions": 0
}
```

## Agents

```http
GET /agents
```

Response:

```json
{
  "agents": []
}
```

### Rename agent

```http
PUT /agents/:id
Content-Type: application/json
```

Request:

```json
{
  "name": "New Display Name"
}
```

Response:

```json
{
  "agent": {}
}
```

Renamed agents use `nameSource: "manual"`; telemetry no longer overwrites the name unless the adapter is `source-name-reload`.

## Events

```http
GET /events?limit=100
```

Response:

```json
{
  "events": []
}
```

The Fleet Control detail view uses `GET /events?limit=200` and filters client-side by agent id.

## Tasks

```http
GET /tasks
```

Response:

```json
{
  "tasks": []
}
```

Tasks are derived from `agent.task.started`, `agent.task.completed`, `agent.task.blocked`, `agent.task.failed`, and status events that include `payload.task`.

## Conclusions

```http
GET /conclusions
```

Response:

```json
{
  "conclusions": []
}
```

Conclusions are captured from `event.conclusion` or `message.assistant` content.

## Alerts

```http
GET /alerts
```

Response:

```json
{
  "alerts": []
}
```

## Acknowledge alert

```http
POST /alerts/:id/ack
```

Response:

```json
{
  "acknowledged": true,
  "alert": {}
}
```

## Rules

### List rules

```http
GET /rules
```

### Create rule

```http
POST /rules
Content-Type: application/json
```

Example:

```json
{
  "name": "Blocked detector",
  "enabled": true,
  "match": {
    "field": "event.content",
    "operator": "contains",
    "value": "blocked"
  },
  "alert": {
    "severity": "warning",
    "title": "Blocked output"
  }
}
```

### Update rule

```http
PUT /rules/:id
Content-Type: application/json
```

Example:

```json
{
  "enabled": false
}
```

### Delete rule

```http
DELETE /rules/:id
```

## Realtime stream

```http
GET /stream
```

Uses Server-Sent Events.

Events currently emitted:

- `connected`
- `event.created`
- `conclusion.created`
- `alert.created`
- `alert.updated`
- `agent.updated`
- `agents.updated`
- `tasks.updated`
- `dashboard.updated`
- `rule.updated`

Each SSE frame uses the standard format:

```text
event: event.created
data: { ...json... }
```
