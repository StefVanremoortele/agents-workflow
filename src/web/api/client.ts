import { apiBase } from "@/config";
import type { AgentRecord, AgentTaskRecord, ConclusionRecord, DashboardSummary, DashboardSnapshot, HarnessEventRecord } from "@/types/view";

export async function fetchDashboard(): Promise<DashboardSummary> {
  const response = await fetch(`${apiBase}/dashboard`);
  return (await response.json()) as DashboardSummary;
}

export async function fetchAgents(): Promise<AgentRecord[]> {
  const response = await fetch(`${apiBase}/agents`);
  return ((await response.json()) as { agents: AgentRecord[] }).agents;
}

export async function fetchTasks(): Promise<AgentTaskRecord[]> {
  const response = await fetch(`${apiBase}/tasks`);
  return ((await response.json()) as { tasks: AgentTaskRecord[] }).tasks;
}

export async function fetchEvents(limit = 200): Promise<HarnessEventRecord[]> {
  const response = await fetch(`${apiBase}/events?limit=${limit}`);
  return ((await response.json()) as { events: HarnessEventRecord[] }).events;
}

export async function fetchConclusions(): Promise<ConclusionRecord[]> {
  const response = await fetch(`${apiBase}/conclusions`);
  return ((await response.json()) as { conclusions: ConclusionRecord[] }).conclusions;
}

export async function renameAgent(id: string, name: string): Promise<void> {
  const response = await fetch(`${apiBase}/agents/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Failed to rename agent");
}

export type FleetLoad = {
  snapshot: DashboardSnapshot;
  events: HarnessEventRecord[];
  conclusions: ConclusionRecord[];
};

export async function loadFleet(): Promise<FleetLoad> {
  const [dashboard, agents, tasks, events, conclusions] = await Promise.all([
    fetchDashboard(),
    fetchAgents(),
    fetchTasks(),
    fetchEvents(200),
    fetchConclusions(),
  ]);
  return { snapshot: { dashboard, agents, tasks }, events, conclusions };
}
