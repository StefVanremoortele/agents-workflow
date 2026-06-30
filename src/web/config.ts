import type { DashboardSummary } from "@/types/view";

export const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:4000";
export const snapshotCacheKey = "harness.fleet.snapshot";
export const histLength = 28;
export const globalHistLength = 48;

export const emptyDashboard: DashboardSummary = {
  agentsTotal: 0,
  agentsWorking: 0,
  agentsIdle: 0,
  agentsBlocked: 0,
  agentsOffline: 0,
  projectsActive: 0,
  alertsUnacknowledged: 0,
  alertsCritical: 0,
  recentEventCount: 0,
  runningTasks: 0,
  recentConclusions: 0,
};
