#!/usr/bin/env node

const serverUrl = process.env.HARNESS_SERVER_URL ?? "http://localhost:4000";
const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const projectName = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
const sourceId = process.env.HARNESS_SOURCE_ID ?? `claude-code:${cwd}`;
const logPath = process.env.HARNESS_ADAPTER_LOG ?? `${cwd}/.harness/claude-code-hook.log`;
const outboxPath = process.env.HARNESS_OUTBOX_PATH ?? `${cwd}/.harness/outbox.jsonl`;

let input = {};
try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (text) input = JSON.parse(text);
} catch {
  input = {};
}

const hookName = input.hook_event_name ?? process.env.CLAUDE_HOOK_EVENT_NAME ?? "unknown";
const sessionId = input.session_id ?? input.transcript_path ?? undefined;
const prompt = typeof input.prompt === "string" ? input.prompt : undefined;
const dynamicSourceName = getSourceName(input);

await log(`hook=${hookName} keys=${Object.keys(input).join(",")} name=${dynamicSourceName} transcript=${input.transcript_path ?? "none"}`);

const events = await toHarnessEvents(hookName, input);
await log(`events=${events.map((event) => event.type).join(",")}`);
for (const event of events) {
  await postEvent(event);
}

async function toHarnessEvents(hookName, raw) {
  const events = [toHarnessEvent(hookName, raw)];
  if (hookName === "Stop" || hookName === "SubagentStop") {
    const conclusion = await readLatestAssistantText(raw.transcript_path);
    await log(`assistantText=${conclusion ? conclusion.length : 0}`);
    if (conclusion) {
      events.unshift({
        type: "message.assistant",
        title: "Claude Code assistant output",
        content: conclusion.slice(0, 8000),
        severity: inferSeverity(conclusion),
        tags: ["claude-code", "assistant", "conclusion"],
        conclusion: conclusion.slice(0, 8000),
        payload: { hookName, transcriptPath: raw.transcript_path },
      });
    }
  }
  return events;
}

function toHarnessEvent(hookName, raw) {
  if (hookName === "SessionStart") {
    return {
      type: "agent.status",
      title: "Claude Code session started",
      severity: "info",
      tags: ["claude-code", "session"],
      payload: { status: "idle", hookName, raw },
    };
  }

  if (hookName === "UserPromptSubmit") {
    return {
      type: "agent.status",
      title: "Claude Code started working",
      content: prompt,
      severity: "info",
      tags: ["claude-code", "prompt"],
      payload: { status: "working", task: prompt, hookName, raw },
    };
  }

  if (hookName === "Stop" || hookName === "SubagentStop") {
    return {
      type: "agent.status",
      title: "Claude Code became idle",
      severity: "info",
      tags: ["claude-code", "session"],
      payload: { status: "idle", hookName, raw },
    };
  }

  if (hookName === "Notification") {
    return {
      type: "agent.status",
      title: "Claude Code notification",
      content: raw.message,
      severity: "notice",
      tags: ["claude-code", "notification"],
      payload: { status: "waiting_for_input", hookName, raw },
    };
  }

  return {
    type: "claude.hook",
    title: `Claude Code hook: ${hookName}`,
    severity: "debug",
    tags: ["claude-code", "hook", String(hookName)],
    payload: { hookName, raw },
  };
}

async function readLatestAssistantText(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== "string") return undefined;
  try {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(transcriptPath, "utf8");
    const lines = text.trim().split(/\n/).reverse();
    await log(`transcriptLines=${lines.length}`);
    for (const line of lines) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line);
      const found = findAssistantText(entry);
      if (found) return found;
    }
  } catch (error) {
    await log(`readLatestAssistantText error=${error?.message ?? error}`);
    return undefined;
  }
}

function findAssistantText(value, depth = 0) {
  if (!value || depth > 6) return undefined;
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => findAssistantText(item, depth + 1))
      .filter((text) => typeof text === "string" && text.trim().length > 0);
    return parts.length > 0 ? parts.join("\n") : undefined;
  }
  if (typeof value !== "object") return undefined;

  if (value.role === "assistant") {
    const content = value.content ?? value.message?.content;
    const text = extractTextContent(content);
    if (text) return text;
  }

  if (value.type === "assistant" || value.type === "assistant_message") {
    const text = extractTextContent(value.content ?? value.message?.content ?? value.text);
    if (text) return text;
  }

  for (const key of ["message", "entry", "data", "payload"]) {
    const text = findAssistantText(value[key], depth + 1);
    if (text) return text;
  }

  return undefined;
}

function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const parts = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && part.type === "text" && typeof part.text === "string") return part.text;
      return undefined;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function getSourceName(raw) {
  return process.env.HARNESS_SOURCE_NAME
    ?? firstString(
      raw.session_name,
      raw.sessionName,
      raw.session_title,
      raw.sessionTitle,
      raw.name,
      raw.title,
      raw.workspace?.name,
      raw.project?.name,
    )
    ?? "Claude Code";
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function inferSeverity(text) {
  if (/\b(critical|security|vulnerability|data loss|secret leaked)\b/i.test(text)) return "critical";
  if (/\b(failed|failure|error|exception|blocked|cannot proceed)\b/i.test(text)) return "error";
  if (/\b(warning|caution|requires human|manual decision|uncertain)\b/i.test(text)) return "warning";
  return "info";
}

async function log(message) {
  try {
    const { mkdir, appendFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, `${new Date().toISOString()} ${message}\n`);
  } catch {}
}

async function postEvent(event) {
  const body = {
    schemaVersion: "1",
    source: {
      id: sourceId,
      type: "agent",
      name: dynamicSourceName,
      adapter: "claude-code-hook",
      project: {
        name: process.env.HARNESS_PROJECT_NAME ?? projectName,
        path: cwd,
      },
      host: { cwd },
    },
    event,
    context: {
      sessionId,
      visibility: "project",
    },
  };

  try {
    await fetch(`${serverUrl}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await log(`posted type=${event.type} status=ok`);
  } catch (error) {
    await enqueueOutbox(body);
    await log(`post failed type=${event.type} queued=outbox error=${error?.message ?? error}`);
    // Do not break Claude Code if the harness server is offline.
  }
}

async function enqueueOutbox(body) {
  try {
    const { mkdir, appendFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(outboxPath), { recursive: true });
    await appendFile(outboxPath, `${JSON.stringify(body)}\n`);
  } catch (error) {
    await log(`outbox failed error=${error?.message ?? error}`);
  }
}
