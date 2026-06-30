#!/usr/bin/env bash
set -euo pipefail

curl -X POST http://localhost:4000/events \
  -H 'Content-Type: application/json' \
  --data @simulated-task-started.json
