# Alerts and Rules

The harness server creates alerts by evaluating incoming events against trigger rules.

## Alert record

```ts
type AlertRecord = {
  id: string;
  ruleId: string;
  eventId: string;
  sourceId: string;
  title: string;
  content?: string;
  severity: Severity;
  acknowledged: boolean;
  createdAt: string;
};
```

## Trigger rule

```ts
type TriggerRule = {
  id: string;
  name: string;
  enabled: boolean;
  match: {
    field: "event.type" | "event.title" | "event.content" | "event.conclusion" | "event.severity";
    operator: "contains" | "equals" | "regex";
    value: string;
  };
  alert: {
    severity: Severity;
    title: string;
  };
};
```

## Default rules

### Test/failure detector

Matches `event.content` using regex:

```text
\b(failed|failure|failing|error|exception)\b
```

Creates an `error` alert titled:

```text
Noteworthy failure detected
```

### Human decision detector

Matches `event.conclusion` containing:

```text
requires human
```

Creates a `warning` alert titled:

```text
Human decision requested
```

## Alert creation flow

```text
POST /events
  ↓
store event
  ↓
reduce event into agent state
  ↓
evaluate enabled trigger rules
  ↓
create matching alerts
  ↓
broadcast alert.created
  ↓
broadcast dashboard.updated
```

## Acknowledgement

Alerts can be acknowledged with:

```http
POST /alerts/:id/ack
```

Acknowledgement:

- sets `acknowledged` to `true`
- persists the alert
- emits `alert.updated`
- emits `dashboard.updated`

The current Fleet Control UI does not expose an alert panel, but the API and SSE events are implemented.

## Current limitations

- no authentication/authorization
- no per-client broadcast policies yet
- current Fleet Control UI does not expose rule editing or alert management
- no advanced boolean logic yet
- no rule test/simulation UI yet
