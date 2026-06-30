import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type HarnessReporterConfig = {
  serverUrl?: string;
  sourceId?: string;
  sourceName?: string;
};

type ReporterContext = {
  cwd: string;
  sessionManager?: { getSessionFile(): string | undefined };
  model?: { provider?: string; id?: string; name?: string };
};

type LlmInfo = {
  provider?: string;
  id?: string;
  name?: string;
  reasoningLevel?: string;
};

function readJsonConfig(path: string): HarnessReporterConfig {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as HarnessReporterConfig;
  } catch {
    return {};
  }
}

function readHarnessReporterConfig(cwd: string): HarnessReporterConfig {
  const globalConfig = readJsonConfig(resolve(homedir(), ".pi/agent/harness-reporter.json"));
  const projectConfig = readJsonConfig(resolve(cwd, ".harness/pi-harness.json"));
  const explicitConfig = process.env.PI_HARNESS_CONFIG ? readJsonConfig(resolve(process.env.PI_HARNESS_CONFIG)) : {};
  return { ...globalConfig, ...projectConfig, ...explicitConfig };
}

function getServerUrl(config: HarnessReporterConfig): string {
  return process.env.HARNESS_SERVER_URL ?? config.serverUrl ?? "http://localhost:4000";
}

function getSource(cwd: string, sessionKey: string, config: HarnessReporterConfig): { id: string; name: string } {
  const baseId = process.env.HARNESS_SOURCE_ID ?? config.sourceId ?? `pi:${cwd}`;
  return {
    id: `${baseId}:session:${stableHash(sessionKey)}`,
    name: process.env.HARNESS_SOURCE_NAME ?? config.sourceName ?? "Pi Agent",
  };
}

function getSessionKey(ctx: { sessionManager?: { getSessionFile(): string | undefined } }): string {
  const sessionFile = ctx.sessionManager?.getSessionFile()
    ?? process.env.PI_SESSION_ID
    ?? process.env.HARNESS_SESSION_ID
    ?? "ephemeral";
  return `${sessionFile}:pid:${process.pid}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function extractTextContent(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const parts = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part && typeof part.text === "string") return part.text;
      return undefined;
    })
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function inferSeverity(text: string): "debug" | "info" | "notice" | "warning" | "error" | "critical" {
  if (/\b(critical|security|vulnerability|data loss|secret leaked)\b/i.test(text)) return "critical";
  if (/\b(failed|failure|error|exception|blocked|cannot proceed)\b/i.test(text)) return "error";
  if (/\b(warning|caution|requires human|manual decision|uncertain)\b/i.test(text)) return "warning";
  return "info";
}

function getLlmInfo(ctx: ReporterContext, pi: ExtensionAPI): LlmInfo | undefined {
  const model = ctx.model;
  if (!model) return undefined;
  const reasoningLevel = pi.getThinkingLevel();
  return {
    provider: model.provider,
    id: model.id,
    name: model.name,
    reasoningLevel,
  };
}

type HarnessEvent = {
  schemaVersion: "1";
  source: {
    id: string;
    type: "agent";
    name: string;
    adapter: string;
    llm?: LlmInfo;
    project: {
      name: string;
      path: string;
    };
    host: {
      cwd: string;
    };
  };
  event: {
    type: string;
    title?: string;
    content?: string;
    severity?: "debug" | "info" | "notice" | "warning" | "error" | "critical";
    tags?: string[];
    conclusion?: string;
    payload?: Record<string, unknown>;
  };
  context?: {
    sessionId?: string;
    visibility?: "private" | "project" | "global";
  };
};

export default function harnessReporter(pi: ExtensionAPI) {
  const globalState = globalThis as typeof globalThis & { __piHarnessReporterLoaded?: boolean };
  if (globalState.__piHarnessReporterLoaded) return;
  globalState.__piHarnessReporterLoaded = true;

  const assistantConclusions = new Map<string, string>();

  async function send(ctx: ReporterContext, event: HarnessEvent["event"]) {
    const projectName = ctx.cwd.split(/[\\/]/).filter(Boolean).pop() ?? ctx.cwd;
    const sessionId = ctx.sessionManager?.getSessionFile();
    const sessionKey = getSessionKey(ctx);
    const config = readHarnessReporterConfig(ctx.cwd);
    const serverUrl = getServerUrl(config);
    const source = getSource(ctx.cwd, sessionKey, config);
    const payload: HarnessEvent = {
      schemaVersion: "1",
      source: {
        id: source.id,
        type: "agent",
        name: source.name,
        adapter: "pi-extension",
        llm: getLlmInfo(ctx, pi),
        project: { name: projectName, path: ctx.cwd },
        host: { cwd: ctx.cwd },
      },
      event,
      context: {
        sessionId: sessionId ?? sessionKey,
        visibility: "project",
      },
    };

    try {
      await fetch(`${serverUrl}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Keep the coding agent usable if the harness server is offline.
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    await send(ctx, {
      type: "agent.status",
      title: "Pi session started",
      severity: "info",
      tags: ["pi", "session"],
      payload: { status: "idle" },
    });
  });

  pi.on("model_select", async (event, ctx) => {
    await send(ctx, {
      type: "agent.status",
      title: `Model selected: ${event.model.id}`,
      severity: "info",
      tags: ["pi", "model"],
      payload: { status: "idle", model: event.model.id, reasoningLevel: pi.getThinkingLevel() },
    });
  });

  pi.on("thinking_level_select", async (event, ctx) => {
    await send(ctx, {
      type: "agent.status",
      title: `Reasoning level selected: ${event.level}`,
      severity: "info",
      tags: ["pi", "model"],
      payload: { status: "idle", model: ctx.model?.id, reasoningLevel: event.level },
    });
  });

  pi.on("before_agent_start", async (event, ctx) => {
    await send(ctx, {
      type: "agent.task.started",
      title: event.prompt.slice(0, 140) || "Pi task started",
      content: event.prompt,
      severity: "info",
      tags: ["pi", "agent", "task"],
      payload: { status: "working", task: event.prompt.slice(0, 140) || "Pi task", taskId: `${Date.now()}` },
    });
  });

  pi.on("agent_start", async (_event, ctx) => {
    await send(ctx, {
      type: "agent.status",
      title: "Pi agent started working",
      severity: "info",
      tags: ["pi", "agent"],
      payload: { status: "working" },
    });
  });

  pi.on("agent_end", async (_event, ctx) => {
    const sessionKey = getSessionKey(ctx);
    const conclusion = assistantConclusions.get(sessionKey);
    if (conclusion) {
      await send(ctx, {
        type: "message.assistant",
        title: "Pi assistant final response",
        content: conclusion.slice(0, 8000),
        conclusion: conclusion.slice(0, 8000),
        severity: inferSeverity(conclusion),
        tags: ["pi", "assistant", "conclusion"],
        payload: { status: "working" },
      });
      assistantConclusions.delete(sessionKey);
    }

    await send(ctx, {
      type: "agent.task.completed",
      title: conclusion ? "Pi task completed" : "Pi task completed",
      severity: conclusion ? inferSeverity(conclusion) : "info",
      tags: ["pi", "agent", "task"],
      payload: { status: "idle" },
    });
    await send(ctx, {
      type: "agent.status",
      title: "Pi agent became idle",
      severity: "info",
      tags: ["pi", "agent"],
      payload: { status: "idle" },
    });
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    const text = extractTextContent(event.message.content);
    if (!text?.trim()) return;
    assistantConclusions.set(getSessionKey(ctx), text.trim());
  });

  pi.on("tool_call", async (event, ctx) => {
    await send(ctx, {
      type: "tool.call",
      title: `Tool call: ${event.toolName}`,
      severity: "debug",
      tags: ["pi", "tool", event.toolName],
      payload: { tool: event.toolName, input: event.input },
    });
  });

  pi.on("tool_result", async (event, ctx) => {
    const text = event.content.map((item) => item.type === "text" ? item.text : `[${item.type}]`).join("\n");
    await send(ctx, {
      type: "tool.result",
      title: `Tool result: ${event.toolName}`,
      content: text.slice(0, 8000),
      severity: event.isError ? "error" : "info",
      tags: ["pi", "tool", event.toolName],
      conclusion: event.isError ? "Tool returned an error" : undefined,
      payload: { tool: event.toolName, isError: event.isError, input: event.input },
    });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await send(ctx, {
      type: "agent.stopped",
      title: "Pi session stopped",
      severity: "info",
      tags: ["pi", "session"],
      payload: { status: "offline" },
    });
  });
}
