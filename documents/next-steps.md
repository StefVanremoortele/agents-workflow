# Next Steps

These are recommended next steps from the current implementation.

## Authentication and authorization

Current server has no auth.

Needed before exposing beyond localhost:

- API keys for producers
- dashboard login
- per-project access control
- secret handling

## Better rule engine

Current rules support one simple condition.

Future rule engine could support:

- multiple conditions
- boolean logic
- project/source filters
- severity filters
- regex test UI
- rate limiting/deduplication
- cooldown windows
- broadcast policies

## Broadcast/subscription policies

Current SSE updates go to all connected dashboard clients.

Future policies:

- project-specific subscriptions
- user-specific subscriptions
- severity-based routing
- Slack/Discord/webhook outputs
- desktop notifications

## Interactive control

Current Pause/Stop/Respond buttons in the UI are placeholders.

Potential control features:

- approve/reject tool calls
- pause/stop agents
- send steering messages to agents
- request summaries
- force plan mode
- require human approval for protected paths

## More producer adapters

Implemented producers currently include Pi and Claude Code. Potential additional producers:

- Codex CLI
- Aider
- generic terminal wrapper
- CI systems
- test runners
- git hooks

## Dashboard improvements

Possible UI additions:

- project grouping
- richer event stream panel
- alert filters and alert detail view
- rule editor modal
- charts and timelines
- stored first-class task step records instead of inferred detail steps
- dark/light theme support
- runtime (not just build-time `VITE_API_BASE`) API base URL configuration

## Production hardening

Needed later:

- structured logging
- input size limits
- request timeouts
- schema validation library
- tests
- Dockerfile
- health checks
- graceful shutdown
- configuration file/env management
- database migrations beyond opportunistic schema initialization

## Repository hygiene

Recommended soon:

- add `.gitignore`
- add tests
- add linting/formatting
- add README at project root
- decide whether generated `dist/` and `dist-server/` should be committed
