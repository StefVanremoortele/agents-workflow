import { apiBase } from "@/config";
import type { AgentRecord, AgentTaskRecord, ConclusionRecord, DashboardSummary, HarnessEventRecord } from "@/types/view";

export type StreamHandlers = {
  onOpen?: () => void;
  onStatus?: (status: "online" | "offline") => void;
  onEvent?: (event: HarnessEventRecord) => void;
  onConclusion?: (conclusion: ConclusionRecord) => void;
  onAgents?: (agents: AgentRecord[]) => void;
  onAgent?: (agent: AgentRecord) => void;
  onTasks?: (tasks: AgentTaskRecord[]) => void;
  onDashboard?: (dashboard: DashboardSummary) => void;
};

/**
 * Opens the harness SSE stream and dispatches named events to handlers.
 * Returns a cleanup function that closes the connection.
 */
export function createEventStream(handlers: StreamHandlers): () => void {
  const stream = new EventSource(`${apiBase}/stream`);

  stream.onopen = () => {
    handlers.onStatus?.("online");
    handlers.onOpen?.();
  };
  stream.onerror = () => handlers.onStatus?.("offline");

  stream.addEventListener("event.created", (message) => {
    handlers.onEvent?.(JSON.parse(message.data) as HarnessEventRecord);
    handlers.onStatus?.("online");
  });
  stream.addEventListener("conclusion.created", (message) => {
    handlers.onConclusion?.(JSON.parse(message.data) as ConclusionRecord);
    handlers.onStatus?.("online");
  });
  stream.addEventListener("agents.updated", (message) => {
    const payload = JSON.parse(message.data) as { agents: AgentRecord[] };
    handlers.onAgents?.(payload.agents);
    handlers.onStatus?.("online");
  });
  stream.addEventListener("agent.updated", (message) => {
    const updated = JSON.parse(message.data) as AgentRecord | undefined;
    if (updated) handlers.onAgent?.(updated);
    handlers.onStatus?.("online");
  });
  stream.addEventListener("tasks.updated", (message) => {
    handlers.onTasks?.(JSON.parse(message.data) as AgentTaskRecord[]);
    handlers.onStatus?.("online");
  });
  stream.addEventListener("dashboard.updated", (message) => {
    handlers.onDashboard?.(JSON.parse(message.data) as DashboardSummary);
    handlers.onStatus?.("online");
  });

  return () => stream.close();
}
