import { HarnessDatabase } from "./db.js";
import type { AgentRecord, AgentStatus, AgentTaskRecord, AgentTaskStepRecord, AlertRecord, ConclusionRecord, DashboardSummary, HarnessEvent, HarnessEventInput, Severity, TriggerRule } from "./types.js";

const ACTIVE_STATUSES = new Set<AgentStatus>(["starting", "working", "blocked", "waiting_for_input", "error"]);
const OFFLINE_TIMEOUT_MS = 30_000;

export class HarnessStore {
  private events: HarnessEvent[] = [];
  private alerts: AlertRecord[] = [];
  private conclusions: ConclusionRecord[] = [];
  private agents = new Map<string, AgentRecord>();
  private tasks: AgentTaskRecord[] = [];
  private rules: TriggerRule[] = [];
  private db: HarnessDatabase;

  private defaultRules: TriggerRule[] = [
    {
      id: "rule_test_failures",
      name: "Test failures",
      enabled: true,
      match: { field: "event.content", operator: "regex", value: "\\b(failed|failure|failing|error|exception)\\b" },
      alert: { severity: "error", title: "Noteworthy failure detected" },
    },
    {
      id: "rule_human_decision",
      name: "Human decision required",
      enabled: false,
      match: { field: "event.conclusion", operator: "contains", value: "requires human" },
      alert: { severity: "warning", title: "Human decision requested" },
    },
  ];

  constructor(db = new HarnessDatabase()) {
    this.db = db;
    this.events = this.db.getEvents();
    this.alerts = this.db.getAlerts();
    this.conclusions = this.db.getConclusions();
    this.tasks = this.db.getTasks();
    this.rules = this.db.getRules();
    this.agents = new Map(this.db.getAgents().map((agent) => [agent.id, agent]));
    this.ensureDefaultRules();
  }

  addEvent(input: HarnessEventInput): { event: HarnessEvent; alerts: AlertRecord[]; conclusion?: ConclusionRecord } {
    const event: HarnessEvent = {
      ...input,
      id: input.id ?? `evt_${crypto.randomUUID()}`,
      timestamp: input.timestamp ?? new Date().toISOString(),
      event: {
        severity: "info",
        ...input.event,
      },
    };

    return this.db.transaction(() => {
      this.events.unshift(event);
      this.events = this.events.slice(0, 1000);
      this.db.saveEvent(event);
      this.reduceAgent(event);
      const conclusion = this.captureConclusion(event);
      const alerts = this.evaluateRules(event);
      this.persistAgent(event.source.id);
      return { event, alerts, conclusion };
    });
  }

  getEvents(limit = 100): HarnessEvent[] {
    return this.events.slice(0, limit);
  }

  getAlerts(): AlertRecord[] {
    return this.alerts;
  }

  getConclusions(): ConclusionRecord[] {
    return this.conclusions;
  }

  getTasks(): AgentTaskRecord[] {
    return this.tasks;
  }

  acknowledgeAlert(id: string): AlertRecord | undefined {
    const alert = this.alerts.find((item) => item.id === id);
    if (alert) {
      alert.acknowledged = true;
      this.db.saveAlert(alert);
    }
    return alert;
  }

  getRules(): TriggerRule[] {
    return this.rules;
  }

  addRule(input: Omit<TriggerRule, "id">): TriggerRule {
    const rule: TriggerRule = { ...input, id: `rule_${crypto.randomUUID()}` };
    this.rules.unshift(rule);
    this.db.saveRule(rule);
    return rule;
  }

  updateRule(id: string, input: Partial<Omit<TriggerRule, "id">>): TriggerRule | undefined {
    const index = this.rules.findIndex((rule) => rule.id === id);
    if (index === -1) return undefined;
    this.rules[index] = { ...this.rules[index], ...input, id };
    this.db.saveRule(this.rules[index]);
    return this.rules[index];
  }

  deleteRule(id: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((rule) => rule.id !== id);
    const deletedInMemory = this.rules.length !== before;
    const deletedInDb = this.db.deleteRule(id);
    return deletedInMemory || deletedInDb;
  }

  renameAgent(id: string, name: string): AgentRecord | undefined {
    const agent = this.agents.get(id);
    const trimmedName = name.trim();
    if (!agent || trimmedName.length === 0) return undefined;
    agent.name = trimmedName;
    agent.nameSource = "manual";
    agent.timestamps.lastSeenAt = new Date().toISOString();
    this.db.saveAgent(agent);
    return agent;
  }

  getAgents(): AgentRecord[] {
    this.markOfflineAgents();
    return [...this.agents.values()].sort((a, b) => b.timestamps.lastSeenAt.localeCompare(a.timestamps.lastSeenAt));
  }

  getDashboard(): DashboardSummary {
    const agents = this.getAgents();
    const projectKeys = new Set(agents.map((a) => a.project?.id ?? a.project?.name).filter(Boolean));
    return {
      agentsTotal: agents.length,
      agentsWorking: agents.filter((a) => ACTIVE_STATUSES.has(a.status)).length,
      agentsIdle: agents.filter((a) => a.status === "idle").length,
      agentsBlocked: agents.filter((a) => a.status === "blocked" || a.status === "waiting_for_input").length,
      agentsOffline: agents.filter((a) => a.status === "offline").length,
      projectsActive: projectKeys.size,
      alertsUnacknowledged: this.alerts.filter((alert) => !alert.acknowledged).length,
      alertsCritical: this.alerts.filter((alert) => alert.severity === "critical" && !alert.acknowledged).length,
      recentEventCount: this.events.length,
      runningTasks: this.tasks.filter((task) => task.status === "running" || task.status === "blocked").length,
      recentConclusions: this.conclusions.length,
    };
  }

  private captureConclusion(event: HarnessEvent): ConclusionRecord | undefined {
    const content = event.event.conclusion ?? (event.event.type === "message.assistant" ? event.event.content : undefined);
    if (!content?.trim()) return undefined;
    const conclusion: ConclusionRecord = {
      id: `conc_${crypto.randomUUID()}`,
      eventId: event.id,
      sourceId: event.source.id,
      title: event.event.title,
      content: content.trim().slice(0, 8000),
      severity: event.event.severity ?? "info",
      createdAt: event.timestamp,
    };
    this.conclusions.unshift(conclusion);
    this.conclusions = this.conclusions.slice(0, 500);
    this.db.saveConclusion(conclusion);
    return conclusion;
  }

  private evaluateRules(event: HarnessEvent): AlertRecord[] {
    const created: AlertRecord[] = [];
    for (const rule of this.rules) {
      if (!rule.enabled || !matchesRule(event, rule)) continue;
      const alert: AlertRecord = {
        id: `alrt_${crypto.randomUUID()}`,
        ruleId: rule.id,
        eventId: event.id,
        sourceId: event.source.id,
        title: rule.alert.title,
        content: event.event.conclusion ?? event.event.content ?? event.event.title,
        severity: rule.alert.severity,
        acknowledged: false,
        createdAt: new Date().toISOString(),
      };
      this.alerts.unshift(alert);
      this.alerts = this.alerts.slice(0, 500);
      this.db.saveAlert(alert);
      const agent = this.agents.get(event.source.id);
      if (agent) agent.stats.alertCount += 1;
      created.push(alert);
    }
    return created;
  }

  private reduceAgent(event: HarnessEvent): void {
    const now = event.timestamp;
    const existing = this.agents.get(event.source.id);
    const agent: AgentRecord = existing ?? {
      id: event.source.id,
      type: event.source.type,
      name: event.source.name,
      adapter: event.source.adapter,
      llm: event.source.llm,
      status: "starting",
      project: event.source.project,
      host: event.source.host,
      stats: { eventCount: 0, alertCount: 0, errorCount: 0, warningCount: 0 },
      timestamps: { firstSeenAt: now, lastSeenAt: now },
    };

    agent.type = event.source.type;
    if (event.source.name && (agent.nameSource !== "manual" || event.source.adapter === "source-name-reload")) {
      agent.name = event.source.name;
      agent.nameSource = "telemetry";
    }
    agent.adapter = event.source.adapter ?? agent.adapter;
    agent.llm = event.source.llm ?? agent.llm;
    agent.project = event.source.project ?? agent.project;
    agent.host = event.source.host ?? agent.host;
    agent.timestamps.lastSeenAt = now;
    agent.stats.eventCount += 1;
    agent.lastEvent = {
      id: event.id,
      type: event.event.type,
      title: event.event.title,
      content: event.event.content,
      severity: event.event.severity,
      timestamp: now,
    };

    this.countSeverity(event.event.severity, agent);
    this.applyLifecycleEvent(event, agent);
    this.agents.set(agent.id, agent);
  }

  private countSeverity(severity: Severity | undefined, agent: AgentRecord): void {
    if (severity === "warning") agent.stats.warningCount += 1;
    if (severity === "error" || severity === "critical") agent.stats.errorCount += 1;
  }

  private applyLifecycleEvent(event: HarnessEvent, agent: AgentRecord): void {
    const payload = event.event.payload ?? {};
    const status = typeof payload.status === "string" ? payload.status : undefined;
    const task = typeof payload.task === "string" ? payload.task : undefined;

    if (event.event.type === "agent.heartbeat") {
      agent.timestamps.lastHeartbeatAt = event.timestamp;
      if (isAgentStatus(status) && agent.status !== status) {
        agent.status = status;
        agent.timestamps.lastStatusChangeAt = event.timestamp;
      }
    }

    if (event.event.type === "agent.status" && isAgentStatus(status)) {
      if (agent.status !== status) agent.timestamps.lastStatusChangeAt = event.timestamp;
      agent.status = status;
      if ((status === "idle" || status === "offline" || status === "stopping") && agent.currentTask) {
        this.finishCurrentTask(agent, event, "completed");
      }
    }

    if (event.event.type === "agent.task.started" || task) {
      agent.currentTask = this.upsertTask(event, agent, {
        status: "running",
        title: task ?? event.event.title ?? "Untitled task",
        summary: event.event.content,
      });
    }

    if (event.event.type === "agent.task.completed") {
      agent.status = "idle";
      this.finishCurrentTask(agent, event, "completed");
      agent.timestamps.lastStatusChangeAt = event.timestamp;
    }

    if (event.event.type === "agent.task.blocked") {
      agent.status = "blocked";
      agent.currentTask = this.upsertTask(event, agent, {
        status: "blocked",
        title: task ?? event.event.title ?? agent.currentTask?.title ?? "Blocked task",
        summary: event.event.content ?? agent.currentTask?.summary,
      });
      agent.timestamps.lastStatusChangeAt = event.timestamp;
    }

    if (event.event.type === "agent.stopped") {
      agent.status = "offline";
      agent.timestamps.lastStatusChangeAt = event.timestamp;
    }
  }

  private upsertTask(
    event: HarnessEvent,
    agent: AgentRecord,
    input: { status: AgentTaskRecord["status"]; title: string; summary?: string },
  ): AgentTaskRecord {
    const payload = event.event.payload ?? {};
    const taskId = typeof payload.taskId === "string" ? payload.taskId : agent.currentTask?.id ?? `task_${crypto.randomUUID()}`;
    const existing = this.tasks.find((task) => task.id === taskId && task.agentId === agent.id);
    const task: AgentTaskRecord = existing ?? {
      id: taskId,
      agentId: agent.id,
      title: input.title,
      status: input.status,
      startedAt: event.timestamp,
      updatedAt: event.timestamp,
      sourceEventId: event.id,
    };

    task.title = input.title;
    task.summary = input.summary;
    task.status = input.status;
    task.updatedAt = event.timestamp;
    this.applyTaskProgress(event, task);
    if (!existing) this.tasks.unshift(task);
    this.tasks = this.tasks.slice(0, 500);
    this.db.saveTask(task);
    return task;
  }

  private finishCurrentTask(agent: AgentRecord, event: HarnessEvent, status: AgentTaskRecord["status"]): void {
    const payload = event.event.payload ?? {};
    const taskId = typeof payload.taskId === "string" ? payload.taskId : agent.currentTask?.id;
    const task = taskId ? this.tasks.find((item) => item.id === taskId && item.agentId === agent.id) : agent.currentTask;
    if (task) {
      task.status = status;
      task.summary = event.event.content ?? task.summary;
      task.updatedAt = event.timestamp;
      task.completedAt = event.timestamp;
      this.applyTaskProgress(event, task);
      if (status === "completed" && task.progress === undefined) task.progress = 100;
      this.db.saveTask(task);
    }
    agent.currentTask = undefined;
  }

  private applyTaskProgress(event: HarnessEvent, task: AgentTaskRecord): void {
    const payload = event.event.payload ?? {};
    const progress = readNumber(payload.progress) ?? readNumber(payload.progressPercent);
    const step = readNumber(payload.step) ?? readNumber(payload.currentStep);
    const totalSteps = readNumber(payload.totalSteps) ?? readNumber(payload.total);
    const steps = readTaskSteps(payload.steps);

    if (progress !== undefined) task.progress = Math.max(0, Math.min(100, progress));
    if (step !== undefined) task.step = Math.max(0, Math.floor(step));
    if (totalSteps !== undefined) task.totalSteps = Math.max(0, Math.floor(totalSteps));
    if (steps) task.steps = steps;
  }

  private markOfflineAgents(): void {
    const now = Date.now();
    for (const agent of this.agents.values()) {
      if (agent.status === "offline") continue;
      if (now - Date.parse(agent.timestamps.lastSeenAt) > OFFLINE_TIMEOUT_MS) {
        agent.status = "offline";
        agent.timestamps.lastStatusChangeAt = new Date().toISOString();
        this.db.saveAgent(agent);
      }
    }
  }

  private persistAgent(id: string): void {
    const agent = this.agents.get(id);
    if (agent) this.db.saveAgent(agent);
  }

  private ensureDefaultRules(): void {
    const existingIds = new Set(this.rules.map((rule) => rule.id));
    for (const rule of this.defaultRules) {
      if (existingIds.has(rule.id)) continue;
      this.rules.push(rule);
      this.db.saveRule(rule);
    }
  }
}

function isAgentStatus(value: string | undefined): value is AgentStatus {
  return !!value && ["starting", "idle", "working", "blocked", "waiting_for_input", "error", "stopping", "offline"].includes(value);
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readTaskSteps(value: unknown): AgentTaskStepRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const steps = value.flatMap((item, index): AgentTaskStepRecord[] => {
    if (typeof item === "string" && item.trim()) return [{ label: item.trim(), status: "todo" }];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : typeof record.title === "string" ? record.title.trim() : "";
    if (!label) return [];
    const status = readStepStatus(record.status) ?? (index === 0 ? "running" : "todo");
    return [{
      id: typeof record.id === "string" ? record.id : undefined,
      label,
      status,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    }];
  });
  return steps.length ? steps : undefined;
}

function readStepStatus(value: unknown): AgentTaskStepRecord["status"] | undefined {
  if (value === "todo" || value === "running" || value === "completed" || value === "blocked" || value === "failed") return value;
  if (value === "done") return "completed";
  if (value === "active" || value === "in_progress") return "running";
  return undefined;
}

function matchesRule(event: HarnessEvent, rule: TriggerRule): boolean {
  const value = getRuleField(event, rule.match.field);
  if (!value) return false;
  if (rule.match.operator === "equals") return value.toLowerCase() === rule.match.value.toLowerCase();
  if (rule.match.operator === "contains") return value.toLowerCase().includes(rule.match.value.toLowerCase());
  try {
    return new RegExp(rule.match.value, "i").test(value);
  } catch {
    return false;
  }
}

function getRuleField(event: HarnessEvent, field: TriggerRule["match"]["field"]): string {
  switch (field) {
    case "event.type": return event.event.type;
    case "event.title": return event.event.title ?? "";
    case "event.content": return event.event.content ?? "";
    case "event.conclusion": return event.event.conclusion ?? "";
    case "event.severity": return event.event.severity ?? "";
  }
}
