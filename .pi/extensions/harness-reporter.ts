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

type TaskStepStatus = "todo" | "running" | "completed" | "blocked" | "failed";

type TaskStep = {
  id: string;
  label: string;
  status: TaskStepStatus;
  updatedAt?: string;
};

type TaskState = {
  id: string;
  title: string;
  content?: string;
  lifecycleSteps: TaskStep[];
  toolSteps: TaskStep[];
  reportedSteps?: TaskStep[];
  reportedProgress?: number;
  toolCounter: number;
};

const lifecycleStepLabels = [
  "Receive user task",
  "Start agent loop",
  "Run tool calls",
  "Produce assistant response",
  "Complete task",
] as const;

const HarnessProgressParams = {
  type: "object",
  properties: {
    task: { type: "string", description: "Current task title or short summary" },
    progress: { type: "number", minimum: 0, maximum: 100, description: "Explicit percent complete, 0-100" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          status: { enum: ["todo", "running", "completed", "blocked", "failed", "done", "active", "in_progress"] },
        },
        required: ["label"],
      },
    },
  },
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

function createLifecycleSteps(now = new Date().toISOString()): TaskStep[] {
  return lifecycleStepLabels.map((label, index) => ({
    id: `lifecycle:${index + 1}`,
    label,
    status: index === 0 ? "completed" : "todo",
    updatedAt: index === 0 ? now : undefined,
  }));
}

function setStepStatus(steps: TaskStep[], id: string, status: TaskStepStatus): void {
  const step = steps.find((item) => item.id === id);
  if (!step) return;
  step.status = status;
  step.updatedAt = new Date().toISOString();
}

function normalizeStepStatus(value: unknown): TaskStepStatus {
  if (value === "todo" || value === "running" || value === "completed" || value === "blocked" || value === "failed") return value;
  if (value === "done") return "completed";
  if (value === "active" || value === "in_progress") return "running";
  return "todo";
}

function normalizeProgress(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function snapshotSteps(task: TaskState): TaskStep[] {
  return task.reportedSteps ?? [...task.lifecycleSteps, ...task.toolSteps];
}

function lifecycleProgress(task: TaskState): number {
  const completed = task.lifecycleSteps.filter((step) => step.status === "completed").length;
  return Math.round((completed / task.lifecycleSteps.length) * 100);
}

function currentStepIndex(steps: TaskStep[]): number {
  const activeIndex = steps.findIndex((step) => step.status === "running" || step.status === "blocked" || step.status === "failed");
  if (activeIndex >= 0) return activeIndex + 1;
  const firstTodo = steps.findIndex((step) => step.status === "todo");
  return firstTodo >= 0 ? firstTodo + 1 : steps.length;
}

function taskPayload(task: TaskState, status: "working" | "idle" | "blocked" = "working"): Record<string, unknown> {
  const steps = snapshotSteps(task);
  return {
    status,
    task: task.title,
    taskId: task.id,
    progress: task.reportedProgress ?? lifecycleProgress(task),
    progressSource: task.reportedProgress !== undefined || task.reportedSteps ? "producer-reported" : "pi-lifecycle",
    step: currentStepIndex(steps),
    totalSteps: steps.length,
    steps,
  };
}

function toolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    read: "Read file",
    write: "Write file",
    edit: "Edit file",
    bash: "Run shell command",
  };
  return labels[toolName] ?? `Run ${toolName}`;
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
    taskId?: string;
    visibility?: "private" | "project" | "global";
  };
};

export default function harnessReporter(pi: ExtensionAPI) {
  const globalState = globalThis as typeof globalThis & { __piHarnessReporterLoaded?: boolean };
  if (globalState.__piHarnessReporterLoaded) return;
  globalState.__piHarnessReporterLoaded = true;

  const assistantConclusions = new Map<string, string>();
  const tasks = new Map<string, TaskState>();

  function getTask(ctx: ReporterContext): TaskState | undefined {
    return tasks.get(getSessionKey(ctx));
  }

  async function send(ctx: ReporterContext, event: HarnessEvent["event"], taskId?: string) {
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
        taskId,
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

  async function sendTaskUpdate(ctx: ReporterContext, title: string, severity: HarnessEvent["event"]["severity"] = "info") {
    const task = getTask(ctx);
    if (!task) return;
    await send(ctx, {
      type: "agent.task.updated",
      title,
      severity,
      tags: ["pi", "agent", "task", "progress"],
      payload: taskPayload(task),
    }, task.id);
  }

  pi.registerTool({
    name: "harness_progress",
    label: "Harness Progress",
    description: "Report real task checklist/progress to the external harness dashboard. Use only for actual task state, not speculative plans.",
    parameters: HarnessProgressParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      let task = getTask(ctx);
      if (!task) {
        const title = typeof params.task === "string" && params.task.trim() ? params.task.trim().slice(0, 140) : "Pi task";
        task = {
          id: `${Date.now()}-${stableHash(title)}`,
          title,
          lifecycleSteps: createLifecycleSteps(),
          toolSteps: [],
          toolCounter: 0,
        };
        tasks.set(getSessionKey(ctx), task);
      }

      if (typeof params.task === "string" && params.task.trim()) task.title = params.task.trim().slice(0, 140);
      const progress = normalizeProgress(params.progress);
      if (progress !== undefined) task.reportedProgress = progress;
      if (Array.isArray(params.steps)) {
        task.reportedSteps = params.steps
          .filter((step) => step && typeof step === "object" && typeof step.label === "string" && step.label.trim())
          .map((step, index) => ({
            id: typeof step.id === "string" && step.id.trim() ? step.id.trim() : `reported:${index + 1}`,
            label: step.label.trim().slice(0, 160),
            status: normalizeStepStatus(step.status),
            updatedAt: new Date().toISOString(),
          }));
      }

      await sendTaskUpdate(ctx, "Pi task progress reported");
      return {
        content: [{ type: "text", text: "Harness progress updated." }],
        details: { taskId: task.id, progress: task.reportedProgress, steps: task.reportedSteps },
      };
    },
  });

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
    const title = event.prompt.slice(0, 140) || "Pi task";
    const task: TaskState = {
      id: `${Date.now()}-${stableHash(event.prompt)}`,
      title,
      content: event.prompt,
      lifecycleSteps: createLifecycleSteps(),
      toolSteps: [],
      toolCounter: 0,
    };
    tasks.set(getSessionKey(ctx), task);

    await send(ctx, {
      type: "agent.task.started",
      title,
      content: event.prompt,
      severity: "info",
      tags: ["pi", "agent", "task", "progress"],
      payload: taskPayload(task),
    }, task.id);

    const progressGuidance = `\n\n## Harness progress reporting\n\nA tool named \`harness_progress\` is available. Use it only when you have real task progress to report to the external dashboard. Do not copy speculative plans into it. If you use it, send concise steps with statuses: todo, running, completed, blocked, or failed. Tool/lifecycle telemetry is reported automatically, so this tool is optional.\n`;
    if (typeof event.systemPrompt === "string") {
      return { systemPrompt: `${event.systemPrompt}${progressGuidance}` };
    }
    return undefined;
  });

  pi.on("agent_start", async (_event, ctx) => {
    const task = getTask(ctx);
    if (task) {
      setStepStatus(task.lifecycleSteps, "lifecycle:2", "completed");
      setStepStatus(task.lifecycleSteps, "lifecycle:3", "running");
      await sendTaskUpdate(ctx, "Pi agent loop started");
    }
    await send(ctx, {
      type: "agent.status",
      title: "Pi agent started working",
      severity: "info",
      tags: ["pi", "agent"],
      payload: { status: "working" },
    }, task?.id);
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    const text = extractTextContent(event.message.content);
    if (!text?.trim()) return;
    assistantConclusions.set(getSessionKey(ctx), text.trim());

    const task = getTask(ctx);
    if (!task) return;
    if (task.toolSteps.length > 0) setStepStatus(task.lifecycleSteps, "lifecycle:3", "completed");
    setStepStatus(task.lifecycleSteps, "lifecycle:4", "completed");
    setStepStatus(task.lifecycleSteps, "lifecycle:5", "running");
    await sendTaskUpdate(ctx, "Pi assistant response produced");
  });

  pi.on("tool_call", async (event, ctx) => {
    const task = getTask(ctx);
    let toolStepId: string | undefined;
    if (task) {
      setStepStatus(task.lifecycleSteps, "lifecycle:3", "running");
      task.toolCounter += 1;
      toolStepId = `tool:${task.toolCounter}`;
      task.toolSteps.push({
        id: toolStepId,
        label: toolLabel(event.toolName),
        status: "running",
        updatedAt: new Date().toISOString(),
      });
      await sendTaskUpdate(ctx, `Tool call started: ${event.toolName}`, "debug");
    }

    await send(ctx, {
      type: "tool.call",
      title: `Tool call: ${event.toolName}`,
      severity: "debug",
      tags: ["pi", "tool", event.toolName],
      payload: { tool: event.toolName, input: event.input, taskId: task?.id, toolStepId },
    }, task?.id);
  });

  pi.on("tool_result", async (event, ctx) => {
    const task = getTask(ctx);
    if (task) {
      const runningStep = [...task.toolSteps].reverse().find((step) => step.status === "running" && step.label === toolLabel(event.toolName));
      if (runningStep) {
        runningStep.status = event.isError ? "failed" : "completed";
        runningStep.updatedAt = new Date().toISOString();
      }
      await sendTaskUpdate(ctx, `Tool result: ${event.toolName}`, event.isError ? "error" : "info");
    }

    const text = event.content.map((item) => item.type === "text" ? item.text : `[${item.type}]`).join("\n");
    await send(ctx, {
      type: "tool.result",
      title: `Tool result: ${event.toolName}`,
      content: text.slice(0, 8000),
      severity: event.isError ? "error" : "info",
      tags: ["pi", "tool", event.toolName],
      conclusion: event.isError ? "Tool returned an error" : undefined,
      payload: { tool: event.toolName, isError: event.isError, input: event.input, taskId: task?.id },
    }, task?.id);
  });

  pi.on("agent_end", async (_event, ctx) => {
    const sessionKey = getSessionKey(ctx);
    const task = tasks.get(sessionKey);
    const conclusion = assistantConclusions.get(sessionKey);

    if (task) {
      if (task.toolSteps.length > 0) setStepStatus(task.lifecycleSteps, "lifecycle:3", "completed");
      setStepStatus(task.lifecycleSteps, "lifecycle:4", "completed");
      setStepStatus(task.lifecycleSteps, "lifecycle:5", "completed");
    }

    if (conclusion) {
      await send(ctx, {
        type: "message.assistant",
        title: "Pi assistant final response",
        content: conclusion.slice(0, 8000),
        conclusion: conclusion.slice(0, 8000),
        severity: inferSeverity(conclusion),
        tags: ["pi", "assistant", "conclusion"],
        payload: { status: "working", taskId: task?.id },
      }, task?.id);
      assistantConclusions.delete(sessionKey);
    }

    await send(ctx, {
      type: "agent.task.completed",
      title: "Pi task completed",
      severity: conclusion ? inferSeverity(conclusion) : "info",
      tags: ["pi", "agent", "task", "progress"],
      payload: task ? taskPayload(task, "idle") : { status: "idle" },
    }, task?.id);
    await send(ctx, {
      type: "agent.status",
      title: "Pi agent became idle",
      severity: "info",
      tags: ["pi", "agent"],
      payload: { status: "idle" },
    }, task?.id);
    tasks.delete(sessionKey);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    const sessionKey = getSessionKey(ctx);
    const task = tasks.get(sessionKey);
    await send(ctx, {
      type: "agent.stopped",
      title: "Pi session stopped",
      severity: "info",
      tags: ["pi", "session"],
      payload: { status: "offline" },
    }, task?.id);
    tasks.delete(sessionKey);
    assistantConclusions.delete(sessionKey);
  });
}
