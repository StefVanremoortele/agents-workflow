#!/usr/bin/env node

const serverUrl = process.env.HARNESS_SERVER_URL ?? "http://localhost:4000";
const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const projectName = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
const sourceId = process.env.HARNESS_SOURCE_ID ?? `claude-code:${cwd}`;
const sourceName = process.env.HARNESS_SOURCE_NAME;

if (!sourceName || sourceName.trim().length === 0) {
  console.error("HARNESS_SOURCE_NAME is required. Example: export HARNESS_SOURCE_NAME=\"My Agent\"");
  process.exit(1);
}

const body = {
  schemaVersion: "1",
  source: {
    id: sourceId,
    type: "agent",
    name: sourceName.trim(),
    adapter: "source-name-reload",
    project: {
      name: process.env.HARNESS_PROJECT_NAME ?? projectName,
      path: cwd,
    },
    host: { cwd },
  },
  event: {
    type: "agent.status",
    title: "Harness source name reloaded",
    severity: "info",
    tags: ["harness", "source-name", "reload"],
    payload: { status: "idle" },
  },
  context: {
    visibility: "project",
  },
};

const response = await fetch(`${serverUrl}/events`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`Reload failed: HTTP ${response.status} ${text}`);
  process.exit(1);
}

const result = await response.json();
console.log(`Reloaded HARNESS_SOURCE_NAME for ${sourceId}: ${sourceName.trim()} (${result.eventId})`);
