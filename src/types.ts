export type SourceType = "agent" | "script" | "ci" | "human" | "service" | "unknown";
export type Severity = "debug" | "info" | "notice" | "warning" | "error" | "critical";
export type AgentStatus =
  | "starting"
  | "idle"
  | "working"
  | "blocked"
  | "waiting_for_input"
  | "error"
  | "stopping"
  | "offline";

export type ProjectInfo = {
  id?: string;
  name?: string;
  path?: string;
  repository?: string;
  branch?: string;
};

export type LlmInfo = {
  provider?: string;
  id?: string;
  name?: string;
  reasoningLevel?: string;
};

export type EventSource = {
  id: string;
  type: SourceType;
  name?: string;
  adapter?: string;
  llm?: LlmInfo;
  project?: ProjectInfo;
  host?: {
    hostname?: string;
    user?: string;
    cwd?: string;
  };
};

export type EventBody = {
  type: string;
  title?: string;
  content?: string;
  severity?: Severity;
  tags?: string[];
  conclusion?: string;
  payload?: Record<string, unknown>;
};

export type EventContext = {
  sessionId?: string;
  taskId?: string;
  parentEventId?: string;
  correlationId?: string;
  visibility?: "private" | "project" | "global";
  ttlSeconds?: number;
};

export type HarnessEventInput = {
  schemaVersion: "1";
  id?: string;
  timestamp?: string;
  source: EventSource;
  event: EventBody;
  context?: EventContext;
};

export type HarnessEvent = HarnessEventInput & {
  id: string;
  timestamp: string;
};

export type AgentTaskStepRecord = {
  id?: string;
  label: string;
  status: "todo" | "running" | "completed" | "blocked" | "failed";
  updatedAt?: string;
};

export type AgentTaskRecord = {
  id: string;
  agentId: string;
  title: string;
  summary?: string;
  status: "running" | "completed" | "blocked" | "failed";
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  sourceEventId: string;
  progress?: number;
  step?: number;
  totalSteps?: number;
  steps?: AgentTaskStepRecord[];
};

export type AgentRecord = {
  id: string;
  type: SourceType;
  name?: string;
  nameSource?: "telemetry" | "manual";
  adapter?: string;
  llm?: LlmInfo;
  status: AgentStatus;
  project?: ProjectInfo;
  host?: EventSource["host"];
  currentTask?: AgentTaskRecord;
  stats: {
    eventCount: number;
    alertCount: number;
    errorCount: number;
    warningCount: number;
  };
  timestamps: {
    firstSeenAt: string;
    lastSeenAt: string;
    lastStatusChangeAt?: string;
    lastHeartbeatAt?: string;
  };
  lastEvent?: {
    id: string;
    type: string;
    title?: string;
    content?: string;
    severity?: Severity;
    timestamp: string;
  };
};

export type AlertRecord = {
  id: string;
  ruleId: string;
  eventId: string;
  sourceId: string;
  title: string;
  content?: string;
  severity: Severity;
  acknowledged: boolean;
  createdAt: string;
};

export type TriggerRule = {
  id: string;
  name: string;
  enabled: boolean;
  match: {
    field: "event.type" | "event.title" | "event.content" | "event.conclusion" | "event.severity";
    operator: "contains" | "equals" | "regex";
    value: string;
  };
  alert: {
    severity: Severity;
    title: string;
  };
};

export type ConclusionRecord = {
  id: string;
  eventId: string;
  sourceId: string;
  title?: string;
  content: string;
  severity: Severity;
  createdAt: string;
};

export type DashboardSummary = {
  agentsTotal: number;
  agentsWorking: number;
  agentsIdle: number;
  agentsBlocked: number;
  agentsOffline: number;
  projectsActive: number;
  alertsUnacknowledged: number;
  alertsCritical: number;
  recentEventCount: number;
  runningTasks: number;
  recentConclusions: number;
};
