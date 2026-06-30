# Claude Code Producer Adapter

The harness server is agent-agnostic, but each agent still needs a producer adapter that sends events to `POST /events`.

The pi adapter only works inside pi. If you start a session with Claude Code, it will not appear until Claude Code is configured to call an adapter.

## Adapter script

Created:

```text
adapters/claude-code-hook.mjs
```

The script reads Claude Code hook JSON from stdin and sends harness events to the server.

## Environment variables

Optional:

```bash
export HARNESS_SERVER_URL=http://localhost:4000
export HARNESS_SOURCE_ID=claude-main
export HARNESS_SOURCE_NAME="Claude Code"
export HARNESS_PROJECT_NAME="my-project"
```

Defaults:

- `HARNESS_SERVER_URL`: `http://localhost:4000`
- `HARNESS_SOURCE_ID`: `claude-code:<cwd>`
- `HARNESS_SOURCE_NAME`: `Claude Code`
- project name: current directory basename

## Hook mapping

| Claude Code hook | Harness event | Status |
|---|---|---|
| `SessionStart` | `agent.status` | `idle` |
| `UserPromptSubmit` | `agent.status` | `working` |
| `Stop` | `agent.status` | `idle` |
| `SubagentStop` | `agent.status` | `idle` |
| `Notification` | `agent.status` | `waiting_for_input` |
| other hooks | `claude.hook` | unchanged |

## Example Claude Code settings

Add hooks to your Claude Code settings. Depending on your preference, this can be project-local or global.

Project-local example:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/adapters/claude-code-hook.mjs"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/adapters/claude-code-hook.mjs"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/adapters/claude-code-hook.mjs"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/adapters/claude-code-hook.mjs"
          }
        ]
      }
    ]
  }
}
```

For this repo, the absolute command is likely:

```text
node /home/SimitStef/sources/repos/stef/pi-test/adapters/claude-code-hook.mjs
```

## Manual smoke test

Start the server:

```bash
npm run dev:server
```

Then simulate a Claude Code `SessionStart` hook:

```bash
printf '{"hook_event_name":"SessionStart","session_id":"demo-claude-session"}' \
  | node adapters/claude-code-hook.mjs
```

Check agents:

```bash
curl http://localhost:4000/agents
```

You should see a `Claude Code` agent.
