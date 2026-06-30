#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const serverUrl = process.env.HARNESS_SERVER_URL ?? "http://localhost:4000";
const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const projectName = process.env.HARNESS_PROJECT_NAME ?? cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
const configPath = resolve(process.env.PI_HARNESS_CONFIG ?? ".harness/pi-harness.json");
const requestedName = process.argv.slice(2).join(" ").trim();

if (!requestedName) {
  console.error('Usage: node scripts/set-pi-harness-name.mjs "New Pi Harness Name"');
  process.exit(1);
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  }
  return body;
}

async function findPiSourceId() {
  if (process.env.HARNESS_SOURCE_ID) return process.env.HARNESS_SOURCE_ID;

  try {
    const { agents = [] } = await fetchJson("/agents");
    const byCurrentProject = agents.filter((agent) => agent?.project?.path === cwd || agent?.host?.cwd === cwd);
    const piAgent = byCurrentProject.find((agent) => agent.adapter === "pi-extension")
      ?? byCurrentProject.find((agent) => typeof agent.id === "string" && agent.id.startsWith("pi-"))
      ?? byCurrentProject.find((agent) => typeof agent.name === "string" && /pi/i.test(agent.name));
    if (piAgent?.id) return piAgent.id;
  } catch {
    // The server may not be running yet; fall back to a stable project-scoped id.
  }

  return `pi:${cwd}`;
}

const sourceId = await findPiSourceId();
const config = {
  sourceId,
  sourceName: requestedName,
  updatedAt: new Date().toISOString(),
};

await mkdir(dirname(configPath), { recursive: true });
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

let renamed = false;
try {
  await fetchJson(`/agents/${encodeURIComponent(sourceId)}`, {
    method: "PUT",
    body: JSON.stringify({ name: requestedName }),
  });
  renamed = true;
} catch {
  // If the agent does not exist yet, the status event below will create/update it.
}

const event = {
  schemaVersion: "1",
  source: {
    id: sourceId,
    type: "agent",
    name: requestedName,
    adapter: "pi-extension",
    project: { name: projectName, path: cwd },
    host: { cwd },
  },
  event: {
    type: "agent.status",
    title: "Pi harness name updated",
    severity: "info",
    tags: ["pi", "harness", "source-name", "rename"],
    payload: { status: "idle", sourceName: requestedName },
  },
  context: { visibility: "project" },
};

const result = await fetchJson("/events", {
  method: "POST",
  body: JSON.stringify(event),
});

console.log(`Pi harness name set to "${requestedName}" for ${sourceId}.`);
console.log(`Config written to ${configPath}.`);
console.log(`${renamed ? "Renamed existing agent and sent" : "Sent"} refresh event ${result.eventId}.`);
