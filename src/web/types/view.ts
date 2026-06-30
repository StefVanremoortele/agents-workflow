import type { LlmInfo, ProjectInfo } from "../../types";

// Canonical backend records — single source of truth for server-shaped data.
export type {
  AgentRecord,
  AgentTaskRecord,
  ConclusionRecord,
  DashboardSummary,
  AgentStatus,
} from "../../types";

import type { AgentRecord, AgentTaskRecord, DashboardSummary } from "../../types";

// Event shape as consumed by the UI. The server emits full HarnessEvent objects,
// which are structurally assignable to this looser view type.
export type HarnessEventRecord = {
  id: string;
  timestamp: string;
  source: {
    id: string;
    name?: string;
    adapter?: string;
    llm?: LlmInfo;
    project?: ProjectInfo;
    host?: { cwd?: string; hostname?: string; user?: string };
  };
  event: {
    type: string;
    title?: string;
    content?: string;
    severity?: string;
    tags?: string[];
    conclusion?: string;
    payload?: Record<string, unknown>;
  };
  context?: { sessionId?: string; taskId?: string; visibility?: string };
};

// Web-only view types.
export type FleetState = "working" | "waiting" | "idle" | "offline";
export type ViewMode = "cards" | "table";
export type FilterMode = "all" | FleetState;

export type FleetAgent = {
  id: string;
  name: string;
  model: string;
  project: string;
  state: FleetState;
  task: string;
  step: number;
  total: number;
  progress: number;
  eta: string;
  elapsed: string;
  events: number;
  hist: number[];
  raw: AgentRecord;
};

export type DashboardSnapshot = {
  dashboard: DashboardSummary;
  agents: AgentRecord[];
  tasks: AgentTaskRecord[];
};
