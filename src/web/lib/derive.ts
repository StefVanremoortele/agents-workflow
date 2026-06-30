import { histLength } from "@/config";
import { formatDuration } from "@/lib/format";
import { padHistory } from "@/lib/history";
import type { AgentRecord, AgentStatus, AgentTaskRecord, FleetAgent, FleetState, HarnessEventRecord } from "@/types/view";

export function toFleetAgent(
  agent: AgentRecord,
  tasks: AgentTaskRecord[],
  hist: number[],
  recentEvents: HarnessEventRecord[] = [],
): FleetAgent {
  const state = mapState(agent.status);
  const task = agent.currentTask ?? tasks.find((item) => item.agentId === agent.id && (item.status === "running" || item.status === "blocked"));
  const eventCount = agent.stats?.eventCount ?? 0;
  const progress = state === "working" ? inferProgress(agent, task) : state === "idle" ? 100 : 0;
  const total = Math.max(3, Math.min(20, ((task?.id.length ?? agent.id.length) % 14) + 6));
  const step = Math.max(1, Math.min(total, Math.round((progress / 100) * total)));
  const startedAt = task?.startedAt ?? agent.timestamps.lastStatusChangeAt ?? agent.timestamps.firstSeenAt ?? agent.timestamps.lastSeenAt;
  return {
    id: agent.id,
    name: agent.name ?? agent.id,
    model: inferModel(agent, recentEvents),
    project: agent.project?.name ?? agent.project?.path?.split(/[\\/]/).filter(Boolean).pop() ?? "unassigned",
    state,
    task: task?.title ?? agent.lastEvent?.title ?? (state === "offline" ? "Agent is offline" : state === "idle" ? "No active task reported" : "Working"),
    step,
    total,
    progress,
    eta: state === "working" ? inferEta(startedAt, progress) : "—",
    elapsed: formatDuration(Date.now() - Date.parse(startedAt)),
    events: eventCount,
    hist: padHistory(hist, histLength),
    raw: agent,
  };
}

export function mapState(status: AgentStatus): FleetState {
  if (status === "working" || status === "starting" || status === "blocked" || status === "error") return "working";
  if (status === "waiting_for_input") return "waiting";
  if (status === "offline" || status === "stopping") return "offline";
  return "idle";
}

export function inferProgress(agent: AgentRecord, task?: AgentTaskRecord): number {
  const source = `${task?.id ?? agent.lastEvent?.id ?? agent.id}:${agent.stats.eventCount}`;
  let hash = 0;
  for (const char of source) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return Math.max(8, Math.min(96, hash % 100));
}

export function inferEta(startedAt: string, progress: number): string {
  if (progress <= 0) return "—";
  const elapsedMs = Math.max(60_000, Date.now() - Date.parse(startedAt));
  const remainingMs = elapsedMs * ((100 - progress) / progress);
  return formatDuration(remainingMs);
}

export function inferModel(agent: AgentRecord, recentEvents: HarnessEventRecord[] = []): string {
  const llm = agent.llm ?? recentEvents.find((event) => event.source.llm)?.source.llm;
  if (llm?.id || llm?.name) return formatLlmLabel(llm.id ?? llm.name, llm.reasoningLevel);

  for (const event of recentEvents) {
    const model = event.event.payload?.model;
    const reasoningLevel = event.event.payload?.reasoningLevel;
    if (typeof model === "string") return formatLlmLabel(model, typeof reasoningLevel === "string" ? reasoningLevel : undefined);
  }

  const text = `${agent.name ?? ""} ${agent.adapter ?? ""}`.toLowerCase();
  if (text.includes("opus")) return "Claude Opus";
  if (text.includes("haiku")) return "Claude Haiku";
  if (text.includes("sonnet") || text.includes("claude")) return "Claude Sonnet";
  return agent.adapter?.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) ?? agent.type ?? "Agent";
}

export function formatLlmLabel(model: string | undefined, reasoningLevel?: string): string {
  const reasoning = reasoningLevel && reasoningLevel !== "off" ? ` ${reasoningLevel}` : "";
  return `${model ?? "Agent"}${reasoning}`;
}

export function sortAgents(a: AgentRecord, b: AgentRecord): number {
  return b.timestamps.lastSeenAt.localeCompare(a.timestamps.lastSeenAt);
}

export function buildTaskSteps(agent: FleetAgent): Array<{ label: string; state: "done" | "active" | "todo" }> {
  const labels = ["Analyze requirements", "Read relevant files", "Draft implementation plan", "Apply code changes", "Write & adjust tests", "Run test suite", "Lint & typecheck", "Self-review diff", "Update documentation", "Open pull request", "Address review feedback"];
  const doneCount = Math.max(0, Math.min(labels.length, agent.step - 1));
  return labels.map((label, index) => ({ label, state: index < doneCount ? "done" : index === doneCount && agent.state === "working" ? "active" : "todo" }));
}
