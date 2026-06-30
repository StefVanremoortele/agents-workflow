import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type DashboardSummary = {
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

type AgentTaskRecord = {
  id: string;
  agentId: string;
  title: string;
  summary?: string;
  status: "running" | "completed" | "blocked" | "failed";
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};

type AgentRecord = {
  id: string;
  type?: string;
  name?: string;
  nameSource?: "telemetry" | "manual";
  adapter?: string;
  llm?: { provider?: string; id?: string; name?: string; reasoningLevel?: string };
  status: string;
  project?: { name?: string; branch?: string; path?: string; repository?: string };
  host?: { cwd?: string; hostname?: string; user?: string };
  currentTask?: AgentTaskRecord;
  stats: { eventCount: number; alertCount: number; errorCount: number; warningCount: number };
  timestamps: { firstSeenAt?: string; lastSeenAt: string; lastStatusChangeAt?: string; lastHeartbeatAt?: string };
  lastEvent?: { id: string; type: string; title?: string; content?: string; severity?: string; timestamp: string };
};

type HarnessEventRecord = {
  id: string;
  timestamp: string;
  source: { id: string; name?: string; adapter?: string; llm?: AgentRecord["llm"]; project?: AgentRecord["project"]; host?: AgentRecord["host"] };
  event: { type: string; title?: string; content?: string; severity?: string; tags?: string[]; conclusion?: string; payload?: Record<string, unknown> };
  context?: { sessionId?: string; taskId?: string; visibility?: string };
};

type ConclusionRecord = {
  id: string;
  eventId: string;
  sourceId: string;
  title?: string;
  content: string;
  severity: string;
  createdAt: string;
};

type FleetState = "working" | "waiting" | "idle" | "offline";
type ViewMode = "cards" | "table";
type FilterMode = "all" | FleetState;

type FleetAgent = {
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

type DashboardSnapshot = {
  dashboard: DashboardSummary;
  agents: AgentRecord[];
  tasks: AgentTaskRecord[];
};

const apiBase = "http://localhost:4000";
const snapshotCacheKey = "harness.fleet.snapshot";
const histLength = 28;
const globalHistLength = 48;

const emptyDashboard: DashboardSummary = {
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

function App() {
  const [dashboard, setDashboard] = React.useState<DashboardSummary>(emptyDashboard);
  const [agents, setAgents] = React.useState<AgentRecord[]>([]);
  const [tasks, setTasks] = React.useState<AgentTaskRecord[]>([]);
  const [view, setView] = React.useState<ViewMode>("cards");
  const [filter, setFilter] = React.useState<Exclude<FilterMode, "offline">>("all");
  const [showOffline, setShowOffline] = React.useState(false);
  const [live, setLive] = React.useState(true);
  const [clock, setClock] = React.useState(formatClock());
  const [serverStatus, setServerStatus] = React.useState<"connecting" | "online" | "offline">("connecting");
  const [eventTicks, setEventTicks] = React.useState<number[]>([]);
  const [agentHistories, setAgentHistories] = React.useState<Record<string, number[]>>({});
  const [events, setEvents] = React.useState<HarnessEventRecord[]>([]);
  const [conclusions, setConclusions] = React.useState<ConclusionRecord[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | undefined>();
  const [detailNav, setDetailNav] = React.useState({ from: "0px", parity: 0 });
  const previousEventCounts = React.useRef<Record<string, number>>({});

  const eventsByAgent = React.useMemo(() => {
    const grouped: Record<string, HarnessEventRecord[]> = {};
    for (const event of events) {
      grouped[event.source.id] = [...(grouped[event.source.id] ?? []), event];
    }
    return grouped;
  }, [events]);

  const fleetAgents = React.useMemo(
    () => agents.map((agent) => toFleetAgent(agent, tasks, agentHistories[agent.id] ?? seedHistory(agent.id, normalizeActivity(agent.stats.eventCount)), eventsByAgent[agent.id] ?? [])),
    [agents, tasks, agentHistories, eventsByAgent],
  );

  const counts = React.useMemo(() => ({
    all: fleetAgents.length,
    working: fleetAgents.filter((agent) => agent.state === "working").length,
    waiting: fleetAgents.filter((agent) => agent.state === "waiting").length,
    idle: fleetAgents.filter((agent) => agent.state === "idle").length,
    offline: fleetAgents.filter((agent) => agent.state === "offline").length,
  }), [fleetAgents]);

  const visibleAgents = (filter === "all" ? fleetAgents : fleetAgents.filter((agent) => agent.state === filter))
    .filter((agent) => showOffline || agent.state !== "offline");
  const selectedAgent = React.useMemo(() => fleetAgents.find((agent) => agent.id === selectedAgentId), [fleetAgents, selectedAgentId]);
  const selectedAgentIndex = React.useMemo(() => selectedAgentId ? fleetAgents.findIndex((agent) => agent.id === selectedAgentId) : -1, [fleetAgents, selectedAgentId]);
  const epm = React.useMemo(() => eventTicks.reduce((sum, value) => sum + value, 0), [eventTicks]);
  const gspark = React.useMemo(() => padHistory(eventTicks.map((value) => Math.min(1, value / 20)), globalHistLength), [eventTicks]);
  const avgProgress = React.useMemo(() => {
    const working = fleetAgents.filter((agent) => agent.state === "working");
    if (working.length === 0) return 0;
    return Math.round(working.reduce((sum, agent) => sum + agent.progress, 0) / working.length);
  }, [fleetAgents]);

  React.useEffect(() => {
    const cached = readCachedSnapshot();
    if (cached) applySnapshot(cached);
    void refreshSnapshot();

    const stream = new EventSource(`${apiBase}/stream`);
    stream.onopen = () => {
      setServerStatus("online");
      void refreshSnapshot();
    };
    stream.onerror = () => setServerStatus("offline");
    stream.addEventListener("event.created", (message) => {
      const event = JSON.parse(message.data) as HarnessEventRecord;
      setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, 200));
      setServerStatus("online");
      if (live) pushEventTick(1);
    });
    stream.addEventListener("conclusion.created", (message) => {
      const conclusion = JSON.parse(message.data) as ConclusionRecord;
      setConclusions((current) => [conclusion, ...current.filter((item) => item.id !== conclusion.id)].slice(0, 200));
      setServerStatus("online");
    });
    stream.addEventListener("agents.updated", (message) => {
      const payload = JSON.parse(message.data) as { agents: AgentRecord[] };
      setAgents(payload.agents);
      updateHistories(payload.agents);
      setServerStatus("online");
    });
    stream.addEventListener("agent.updated", (message) => {
      const updated = JSON.parse(message.data) as AgentRecord | undefined;
      if (!updated) return;
      setAgents((current) => [updated, ...current.filter((agent) => agent.id !== updated.id)].sort(sortAgents));
      updateHistories([updated]);
      setServerStatus("online");
    });
    stream.addEventListener("tasks.updated", (message) => {
      setTasks(JSON.parse(message.data) as AgentTaskRecord[]);
      setServerStatus("online");
    });
    stream.addEventListener("dashboard.updated", (message) => {
      setDashboard(JSON.parse(message.data) as DashboardSummary);
      setServerStatus("online");
    });

    return () => stream.close();
  }, [live]);

  React.useEffect(() => {
    const interval = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => pushEventTick(0), 60_000);
    return () => window.clearInterval(interval);
  }, [live]);

  async function refreshSnapshot() {
    try {
      const [dashboardResponse, agentsResponse, tasksResponse, eventsResponse, conclusionsResponse] = await Promise.all([
        fetch(`${apiBase}/dashboard`),
        fetch(`${apiBase}/agents`),
        fetch(`${apiBase}/tasks`),
        fetch(`${apiBase}/events?limit=200`),
        fetch(`${apiBase}/conclusions`),
      ]);
      const snapshot: DashboardSnapshot = {
        dashboard: await dashboardResponse.json(),
        agents: ((await agentsResponse.json()) as { agents: AgentRecord[] }).agents,
        tasks: ((await tasksResponse.json()) as { tasks: AgentTaskRecord[] }).tasks,
      };
      applySnapshot(snapshot);
      setEvents(((await eventsResponse.json()) as { events: HarnessEventRecord[] }).events);
      setConclusions(((await conclusionsResponse.json()) as { conclusions: ConclusionRecord[] }).conclusions);
      cacheSnapshot(snapshot);
      updateHistories(snapshot.agents);
      setServerStatus("online");
    } catch {
      setServerStatus("offline");
    }
  }

  function applySnapshot(snapshot: DashboardSnapshot) {
    setDashboard(snapshot.dashboard);
    setAgents(snapshot.agents);
    setTasks(snapshot.tasks);
  }

  function updateHistories(nextAgents: AgentRecord[]) {
    setAgentHistories((current) => {
      const updated = { ...current };
      for (const agent of nextAgents) {
        const previousCount = previousEventCounts.current[agent.id] ?? agent.stats.eventCount;
        const delta = Math.max(0, agent.stats.eventCount - previousCount);
        previousEventCounts.current[agent.id] = agent.stats.eventCount;
        const sample = agent.status === "offline" ? 0 : Math.max(normalizeActivity(agent.stats.eventCount), Math.min(1, delta / 12));
        updated[agent.id] = pushHistory(updated[agent.id] ?? seedHistory(agent.id, sample), sample, histLength);
      }
      return updated;
    });
  }

  function pushEventTick(delta: number) {
    if (!live) return;
    setEventTicks((current) => [...current.slice(-(globalHistLength - 1)), delta]);
  }

  async function renameAgent(id: string, name: string) {
    const response = await fetch(`${apiBase}/agents/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error("Failed to rename agent");
    await refreshSnapshot();
  }

  function openAgent(id: string) {
    setSelectedAgentId(id);
    setDetailNav((current) => ({ from: "0px", parity: current.parity ^ 1 }));
  }

  function navigateAgent(delta: -1 | 1) {
    if (fleetAgents.length === 0) return;
    const currentIndex = selectedAgentIndex >= 0 ? selectedAgentIndex : 0;
    const nextIndex = (currentIndex + delta + fleetAgents.length) % fleetAgents.length;
    setSelectedAgentId(fleetAgents[nextIndex].id);
    setDetailNav((current) => ({ from: delta > 0 ? "38px" : "-38px", parity: current.parity ^ 1 }));
  }

  if (selectedAgent) {
    return (
      <AgentDetailView
        agent={selectedAgent}
        events={events.filter((event) => event.source.id === selectedAgent.id)}
        conclusion={conclusions.find((item) => item.sourceId === selectedAgent.id)}
        onBack={() => setSelectedAgentId(undefined)}
        onNavigate={navigateAgent}
        position={selectedAgentIndex >= 0 ? selectedAgentIndex + 1 : 1}
        total={fleetAgents.length}
        navFrom={detailNav.from}
        navParity={detailNav.parity}
      />
    );
  }

  return (
    <main className="fleet-shell">
      <header className="fleet-header">
        <div className="fleet-titleblock">
          <p className="fleet-kicker">Agent Fleet · Live Observability</p>
          <h1>Agents Platform</h1>
          <p>Real-time view of every agent and exactly what it is working on right now.</p>
        </div>
        <div className="fleet-header-right">
          <section className="throughput-panel">
            <div>
              <span>Throughput</span>
              <strong>{epm}</strong>
              <small>events / min</small>
            </div>
            <Sparkline values={gspark} state="working" className="global-spark" />
          </section>
          <div className="live-row">
            <time>{clock}</time>
            <button className={`live-pill ${live ? "live" : "paused"}`} onClick={() => setLive((value) => !value)}>
              <span /> {live ? "LIVE" : "PAUSED"}
            </button>
          </div>
        </div>
      </header>

      <section className="kpi-strip">
        <Kpi label="Working" value={counts.working} tone="working" />
        <Kpi label="Waiting on input" value={counts.waiting} tone="waiting" />
        <Kpi label="Idle / offline" value={counts.idle + counts.offline} tone="muted" />
        <Kpi label="Avg progress" value={`${avgProgress}%`} />
        <Kpi label="Fleet size" value={dashboard.agentsTotal || counts.all} />
      </section>

      <section className="fleet-controls">
        <div>
          <h2>Live Fleet</h2>
          <p>{counts.all} agents connected · server {serverStatus}</p>
        </div>
        <div className="control-actions">
          <div className="segmented" aria-label="Fleet view">
            <button className={view === "cards" ? "selected" : ""} onClick={() => setView("cards")}>Cards</button>
            <button className={view === "table" ? "selected" : ""} onClick={() => setView("table")}>Table</button>
          </div>
          <button className="refresh-button" onClick={() => void refreshSnapshot()}>Refresh</button>
        </div>
      </section>

      <section className="filter-chips" aria-label="Agent status filters">
        <FilterChip label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterChip label="Working" count={counts.working} active={filter === "working"} onClick={() => setFilter("working")} />
        <FilterChip label="Waiting" count={counts.waiting} active={filter === "waiting"} onClick={() => setFilter("waiting")} />
        <FilterChip label="Idle" count={counts.idle} active={filter === "idle"} onClick={() => setFilter("idle")} />
        <FilterChip label="Offline" count={counts.offline} active={showOffline} onClick={() => setShowOffline((value) => !value)} />
      </section>

      {visibleAgents.length === 0 ? (
        <section className="empty-fleet">
          <h3>No agents match this filter</h3>
          <p>Start an agent or post telemetry to <code>/events</code> to populate Fleet Control.</p>
        </section>
      ) : view === "cards" ? (
        <section className="fleet-grid">
          {visibleAgents.map((agent, index) => <AgentCard key={agent.id} agent={agent} index={index} onRename={renameAgent} onOpen={() => openAgent(agent.id)} />)}
        </section>
      ) : (
        <AgentTable agents={visibleAgents} onRename={renameAgent} onOpen={(agent) => openAgent(agent.id)} />
      )}
    </main>
  );
}

function AgentDetailView({ agent, events, conclusion, onBack, onNavigate, position, total, navFrom, navParity }: { agent: FleetAgent; events: HarnessEventRecord[]; conclusion?: ConclusionRecord; onBack: () => void; onNavigate: (delta: -1 | 1) => void; position: number; total: number; navFrom: string; navParity: number }) {
  const [zen, setZen] = React.useState(false);
  const [conclusionZen, setConclusionZen] = React.useState(false);
  const startedAt = agent.raw.currentTask?.startedAt ?? agent.raw.timestamps.firstSeenAt ?? agent.raw.timestamps.lastSeenAt;
  const steps = buildTaskSteps(agent);
  const repository = agent.raw.project?.repository ?? agent.raw.project?.name ?? agent.project;
  const logEvents = dedupeLogEvents(events.length ? events : fallbackEvents(agent));

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setZen(false);
        setConclusionZen(false);
        return;
      }
      if (zen || conclusionZen) return;
      if (event.key === "ArrowLeft") onNavigate(-1);
      if (event.key === "ArrowRight") onNavigate(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zen, conclusionZen, onNavigate]);

  return (
    <main className="detail-shell">
      <section className="detail-topbar">
        <div className="detail-nav-left">
          <button className="back-button" onClick={onBack}>← Back to fleet</button>
          <div className="detail-carousel" aria-label="Agent session carousel">
            <button onClick={() => onNavigate(-1)} aria-label="Previous agent">‹</button>
            <span>{position} / {Math.max(total, 1)}</span>
            <button onClick={() => onNavigate(1)} aria-label="Next agent">›</button>
          </div>
        </div>
        <div className="detail-actions">{agent.state === "waiting" ? <button className="resume-action">Respond & Resume</button> : null}{agent.state === "working" ? <button>Pause</button> : null}<button>Stop</button></div>
      </section>

      <section className={`detail-carousel-stage cv-${navParity}`} style={{ "--cvfrom": navFrom } as React.CSSProperties}>
      <header className={`detail-hero ${agent.state}`}>
        <div className="detail-title-row">
          <span className="state-dot" />
          <h1>{agent.name}</h1>
          <StatusPill state={agent.state} />
        </div>
        <p>{agent.model} · {agent.project} · {repository} · {shortId(agent.id)}</p>
      </header>

      <section className="detail-metrics">
        <DetailMetric label="Elapsed" value={agent.elapsed} />
        <DetailMetric label="ETA" value={agent.eta} />
        <DetailMetric label="Progress" value={`${agent.progress}%`} accent />
        <DetailMetric label="Events" value={agent.events} />
      </section>

      <section className="detail-grid">
        <div className="detail-maincol">
          <article className="detail-panel current-task-panel">
            <div className="detail-panel-label">Current task</div>
            <h2>{agent.task}</h2>
            {agent.raw.currentTask?.summary ? <MarkdownContent content={agent.raw.currentTask.summary} className="task-summary" /> : null}
            <div className="detail-progress-head"><span>Step {agent.step} / {agent.total}</span><strong>{agent.progress}%</strong></div>
            <div className="progress-track"><span style={{ width: `${agent.progress}%` }} /></div>
            <ol className="task-steps">
              {steps.map((step) => <li key={step.label} className={step.state}><span /> <p>{step.label}</p><em>{step.state === "done" ? "Done" : step.state === "active" ? "In progress" : ""}</em></li>)}
            </ol>
          </article>

        </div>

        <aside className="detail-sidecol">
          <article className="detail-panel throughput-card">
            <div className="detail-panel-label">Throughput</div>
            <Sparkline values={agent.hist} state={agent.state} />
          </article>
          <article className="detail-panel details-card">
            <div className="detail-panel-label">Details</div>
            <DetailRow label="Model" value={agent.model} />
            <DetailRow label="Project" value={agent.project} />
            <DetailRow label="Repository" value={repository} />
            <DetailRow label="Agent ID" value={shortId(agent.id)} />
            <DetailRow label="Started" value={formatTime(startedAt)} />
            <DetailRow label="Uptime" value={agent.elapsed} />
          </article>
        </aside>

        {conclusion ? (
          <article className="detail-panel conclusion-panel detail-fullwidth">
            <div className="activity-log-header">
              <div className="detail-panel-label">Latest conclusion</div>
              <button className="log-expand-button" onClick={() => setConclusionZen(true)} aria-label="Expand latest conclusion"><span aria-hidden="true">⛶</span> Expand</button>
            </div>
            <h3>{conclusion.title ?? "Final response"}</h3>
            <MarkdownContent content={conclusion.content} />
          </article>
        ) : null}

        <article className="detail-panel activity-log-panel detail-fullwidth">
          <div className="activity-log-header">
            <div className="detail-panel-label">Activity log <span className="live-dot" /> <small>live</small></div>
            <button className="log-expand-button" onClick={() => setZen(true)} aria-label="Expand activity log"><span aria-hidden="true">⛶</span> Expand</button>
          </div>
          <div className="activity-log">
            {logEvents.slice(0, 12).map((event) => <ActivityLogRow key={event.id} event={event} />)}
          </div>
        </article>
      </section>
      </section>
      {zen ? <ActivityLogZenOverlay agent={agent} events={logEvents} onExit={() => setZen(false)} /> : null}
      {conclusionZen && conclusion ? <ConclusionZenOverlay agent={agent} conclusion={conclusion} onExit={() => setConclusionZen(false)} /> : null}
    </main>
  );
}

function ActivityLogZenOverlay({ agent, events, onExit }: { agent: FleetAgent; events: HarnessEventRecord[]; onExit: () => void }) {
  return (
    <section className={`zen-overlay ${agent.state}`} role="dialog" aria-modal="true" aria-label={`${agent.name} activity log`}>
      <button className="zen-exit" onClick={onExit}><span aria-hidden="true">⛶</span> Exit</button>
      <div className="zen-inner">
        <header className="zen-header">
          <div className="zen-title-row">
            <span className="state-dot" />
            <h1>{agent.name}</h1>
            <span className="zen-label">Activity log</span>
            <span className="live-dot" />
            <small>live</small>
          </div>
          <p>{agent.task}</p>
        </header>
        <div className="zen-log" tabIndex={0}>
          {events.map((event) => <ActivityLogRow key={event.id} event={event} zen />)}
        </div>
      </div>
    </section>
  );
}

function ConclusionZenOverlay({ agent, conclusion, onExit }: { agent: FleetAgent; conclusion: ConclusionRecord; onExit: () => void }) {
  return (
    <section className={`zen-overlay conclusion-zen ${agent.state}`} role="dialog" aria-modal="true" aria-label={`${agent.name} latest conclusion`}>
      <button className="zen-exit" onClick={onExit}><span aria-hidden="true">⛶</span> Exit</button>
      <div className="zen-inner">
        <header className="zen-header">
          <div className="zen-title-row">
            <span className="state-dot" />
            <h1>{agent.name}</h1>
            <span className="zen-label">Latest conclusion</span>
          </div>
          <p>{agent.task}</p>
        </header>
        <article className="zen-conclusion" tabIndex={0}>
          <h2>{conclusion.title ?? "Final response"}</h2>
          <MarkdownContent content={conclusion.content} />
        </article>
      </div>
    </section>
  );
}

function DetailMetric({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return <article className="detail-metric"><span>{label}</span><strong className={accent ? "accent" : ""}>{value}</strong></article>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>;
}

function ActivityLogRow({ event, zen = false }: { event: HarnessEventRecord; zen?: boolean }) {
  const kind = eventKind(event.event.type, event.event.severity);
  const detail = event.event.conclusion ?? event.event.content;
  return (
    <div className={`log-row ${detail ? "with-detail" : ""} ${zen ? "zen-row" : ""}`}>
      <time>{formatTime(event.timestamp)}</time>
      <b className={kind.toLowerCase()}>{kind}</b>
      <div className="log-message"><strong>{event.event.title ?? event.event.type}</strong>{detail ? <MarkdownContent content={detail} compact={!zen} /> : null}</div>
    </div>
  );
}

function MarkdownContent({ content, compact = false, className = "" }: { content: string; compact?: boolean; className?: string }) {
  const blocks = parseMarkdownBlocks(content);
  return <div className={`markdown-content ${compact ? "compact" : ""} ${className}`.trim()}>{blocks.map(renderMarkdownBlock)}</div>;
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string }
  | { type: "quote"; text: string };

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let code: string[] | undefined;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = undefined;
      } else {
        flushParagraph();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    const listMatch = line.match(/^\s*((?:[-*+])|(?:\d+\.))\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = /\d+\./.test(listMatch[1]);
      const items = [listMatch[2]];
      while (index + 1 < lines.length) {
        const next = lines[index + 1].match(/^\s*((?:[-*+])|(?:\d+\.))\s+(.+)$/);
        if (!next || /\d+\./.test(next[1]) !== ordered) break;
        items.push(next[2]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      blocks.push({ type: "quote", text: quote[1] });
      continue;
    }

    paragraph.push(line);
  }

  if (code) blocks.push({ type: "code", text: code.join("\n") });
  flushParagraph();
  return blocks;
}

function renderMarkdownBlock(block: MarkdownBlock, index: number): React.ReactNode {
  if (block.type === "heading") {
    const Tag = `h${Math.min(4, Math.max(3, block.level + 2))}` as keyof React.JSX.IntrinsicElements;
    return <Tag key={index}>{renderMarkdownInline(block.text)}</Tag>;
  }
  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return <Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderMarkdownInline(item)}</li>)}</Tag>;
  }
  if (block.type === "code") return <pre key={index}><code>{block.text}</code></pre>;
  if (block.type === "quote") return <blockquote key={index}>{renderMarkdownInline(block.text)}</blockquote>;
  return <p key={index}>{renderMarkdownInline(block.text)}</p>;
}

function renderMarkdownInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) nodes.push(<em key={nodes.length}>{token.slice(1, -1)}</em>);
    else if (token.startsWith("`")) nodes.push(<code key={nodes.length}>{token.slice(1, -1)}</code>);
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      nodes.push(<a key={nodes.length} href={link?.[2] ?? "#"} target="_blank" rel="noreferrer">{link?.[1] ?? token}</a>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function buildTaskSteps(agent: FleetAgent): Array<{ label: string; state: "done" | "active" | "todo" }> {
  const labels = ["Analyze requirements", "Read relevant files", "Draft implementation plan", "Apply code changes", "Write & adjust tests", "Run test suite", "Lint & typecheck", "Self-review diff", "Update documentation", "Open pull request", "Address review feedback"];
  const doneCount = Math.max(0, Math.min(labels.length, agent.step - 1));
  return labels.map((label, index) => ({ label, state: index < doneCount ? "done" : index === doneCount && agent.state === "working" ? "active" : "todo" }));
}

function fallbackEvents(agent: FleetAgent): HarnessEventRecord[] {
  return [{ id: `${agent.id}:last`, timestamp: agent.raw.lastEvent?.timestamp ?? agent.raw.timestamps.lastSeenAt, source: { id: agent.id }, event: { type: agent.raw.lastEvent?.type ?? "agent.status", title: agent.raw.lastEvent?.title ?? agent.task, severity: agent.raw.lastEvent?.severity ?? "info" } }];
}

function dedupeLogEvents(events: HarnessEventRecord[]): HarnessEventRecord[] {
  const deduped: HarnessEventRecord[] = [];
  for (const event of events) {
    const previous = deduped[deduped.length - 1];
    if (previous && isDuplicateLogEvent(previous, event)) continue;
    deduped.push(event);
  }
  return deduped;
}

function isDuplicateLogEvent(a: HarnessEventRecord, b: HarnessEventRecord): boolean {
  const delta = Math.abs(Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (delta > 1500) return false;
  return logSignature(a) === logSignature(b);
}

function logSignature(event: HarnessEventRecord): string {
  return [
    event.source.id,
    event.event.type,
    event.event.title ?? "",
    event.event.content ?? "",
    event.event.conclusion ?? "",
    JSON.stringify(event.event.payload ?? {}),
  ].join("\u0000");
}

function eventKind(type: string, severity?: string): string {
  if (severity === "error" || severity === "critical") return "ERR";
  if (type.includes("tool")) return "TOOL";
  if (type.includes("message") || type.includes("edit")) return "EDIT";
  if (type.includes("blocked") || type.includes("waiting")) return "WAIT";
  if (type.includes("completed") || type.includes("stopped")) return "DONE";
  if (type.includes("task")) return "RUN";
  return "INFO";
}

function shortId(id: string): string {
  return id.length > 14 ? id.slice(-12) : id;
}

function formatTime(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB");
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "working" | "waiting" | "muted" }) {
  return <article className={`kpi ${tone ?? ""}`}><span>{label}</span><strong>{value}</strong></article>;
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button className={`filter-chip ${active ? "active" : ""}`} onClick={onClick}>{label}<span>{count}</span></button>;
}

function AgentCard({ agent, index, onRename, onOpen }: { agent: FleetAgent; index: number; onRename: (id: string, name: string) => Promise<void>; onOpen: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(agent.name);
  React.useEffect(() => { if (!editing) setName(agent.name); }, [agent.name, editing]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onRename(agent.id, trimmed);
    setEditing(false);
  }

  return (
    <article className={`fleet-card ${agent.state}`} style={{ animationDelay: `${index * 0.04}s` }} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }}>
      <div className="card-head">
        <span className="state-dot" />
        {editing ? (
          <div className="name-edit" onClick={(event) => event.stopPropagation()}>
            <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") void saveName();
              if (event.key === "Escape") setEditing(false);
            }} autoFocus />
            <button onClick={() => void saveName()}>Save</button>
          </div>
        ) : <strong className="agent-name">{agent.name}</strong>}
        <button className="rename-mini" onClick={(event) => { event.stopPropagation(); setEditing(true); }} aria-label={`Rename ${agent.name}`} title="Rename agent">✎</button>
        <StatusPill state={agent.state} />
      </div>
      <p className="agent-subline">{agent.model} · {agent.project}</p>
      <section className="task-block">
        <span>Current task</span>
        <p>{agent.task}</p>
      </section>
      {agent.state === "working" ? <Progress agent={agent} /> : null}
      {agent.state === "waiting" ? <WaitingBanner /> : null}
      <section className="meta-row">
        <div><span>Elapsed</span><strong>{agent.elapsed}</strong></div>
        <div><span>ETA</span><strong>{agent.eta}</strong></div>
      </section>
      <section className="activity-footer">
        <div><span>Activity</span><strong>{agent.events} events</strong></div>
        <Sparkline values={agent.hist} state={agent.state} />
      </section>
    </article>
  );
}

function Progress({ agent }: { agent: FleetAgent }) {
  return (
    <section className="progress-block">
      <div><span>Step {agent.step} / {agent.total}</span><strong>{agent.progress}%</strong></div>
      <div className="progress-track"><span style={{ width: `${agent.progress}%` }} /></div>
    </section>
  );
}

function WaitingBanner() {
  return <section className="waiting-banner"><span>Paused · needs your input</span><button>Respond</button></section>;
}

function AgentTable({ agents, onRename, onOpen }: { agents: FleetAgent[]; onRename: (id: string, name: string) => Promise<void>; onOpen: (agent: FleetAgent) => void }) {
  return (
    <section className="fleet-table">
      <div className="table-row table-head">
        <span>Agent</span><span>Status</span><span>Current task</span><span>Progress</span><span>Elapsed</span><span>ETA</span><span>Activity</span><span>Events</span>
      </div>
      {agents.map((agent) => <AgentTableRow key={agent.id} agent={agent} onRename={onRename} onOpen={() => onOpen(agent)} />)}
    </section>
  );
}

function AgentTableRow({ agent, onRename, onOpen }: { agent: FleetAgent; onRename: (id: string, name: string) => Promise<void>; onOpen: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(agent.name);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { if (!editing) setName(agent.name); }, [agent.name, editing]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === agent.name) {
      setEditing(false);
      setName(agent.name);
      return;
    }
    setSaving(true);
    try {
      await onRename(agent.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="table-row" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }}>
      <div className="table-agent-name" onClick={(event) => event.stopPropagation()}>
        {editing ? (
          <input value={name} disabled={saving} onChange={(event) => setName(event.target.value)} onBlur={() => void saveName()} onKeyDown={(event) => {
            if (event.key === "Enter") void saveName();
            if (event.key === "Escape") {
              setName(agent.name);
              setEditing(false);
            }
          }} aria-label={`Rename ${agent.name}`} autoFocus />
        ) : (
          <>
            <strong>{agent.name}</strong>
            <button onClick={(event) => { event.stopPropagation(); setEditing(true); }} aria-label={`Rename ${agent.name}`} title="Rename agent">✎</button>
          </>
        )}
      </div>
      <StatusPill state={agent.state} compact />
      <span className="task-cell">{agent.task}</span>
      <div className="table-progress"><div><span style={{ width: `${agent.progress}%` }} /></div><b>{agent.progress}%</b></div>
      <span>{agent.elapsed}</span>
      <span>{agent.eta}</span>
      <Sparkline values={agent.hist.slice(-18)} state={agent.state} className="table-spark" />
      <span className="events-cell">{agent.events}</span>
    </div>
  );
}

function StatusPill({ state, compact = false }: { state: FleetState; compact?: boolean }) {
  const label = state === "waiting" ? "Waiting on input" : state[0].toUpperCase() + state.slice(1);
  return <span className={`status-pill ${state} ${compact ? "compact" : ""}`}>{label}</span>;
}

function Sparkline({ values, state, className = "" }: { values: number[]; state: FleetState; className?: string }) {
  const normalized = values.length ? values : [0];
  const width = className.includes("global") ? 160 : className.includes("table") ? 96 : 260;
  const height = className.includes("table") ? 26 : 40;
  const points = normalized.map((value, index) => `${(index / Math.max(1, normalized.length - 1)) * width},${height - Math.max(0.04, value) * (height - 4) - 2}`).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return <svg className={`sparkline ${state} ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polygon points={area} /><polyline points={points} /></svg>;
}

function toFleetAgent(agent: AgentRecord, tasks: AgentTaskRecord[], hist: number[], recentEvents: HarnessEventRecord[] = []): FleetAgent {
  const state = mapState(agent.status);
  const task = agent.currentTask ?? tasks.find((item) => item.agentId === agent.id && (item.status === "running" || item.status === "blocked"));
  const eventCount = agent.stats?.eventCount ?? 0;
  const progress = state === "working" ? inferProgress(agent, task) : state === "idle" ? 100 : 0;
  const total = Math.max(3, Math.min(20, (task?.id.length ?? agent.id.length) % 14 + 6));
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

function mapState(status: string): FleetState {
  if (status === "working" || status === "starting" || status === "blocked" || status === "error") return "working";
  if (status === "waiting_for_input") return "waiting";
  if (status === "offline" || status === "stopping") return "offline";
  return "idle";
}

function inferProgress(agent: AgentRecord, task?: AgentTaskRecord): number {
  const source = `${task?.id ?? agent.lastEvent?.id ?? agent.id}:${agent.stats.eventCount}`;
  let hash = 0;
  for (const char of source) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return Math.max(8, Math.min(96, hash % 100));
}

function inferEta(startedAt: string, progress: number): string {
  if (progress <= 0) return "—";
  const elapsedMs = Math.max(60_000, Date.now() - Date.parse(startedAt));
  const remainingMs = elapsedMs * ((100 - progress) / progress);
  return formatDuration(remainingMs);
}

function inferModel(agent: AgentRecord, recentEvents: HarnessEventRecord[] = []): string {
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

function formatLlmLabel(model: string | undefined, reasoningLevel?: string): string {
  const reasoning = reasoningLevel && reasoningLevel !== "off" ? ` ${reasoningLevel}` : "";
  return `${model ?? "Agent"}${reasoning}`;
}

function normalizeActivity(events: number): number {
  return Math.max(0.05, Math.min(1, (events % 18) / 18));
}

function seedHistory(seed: string, baseline: number): number[] {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) % 1009;
  return Array.from({ length: histLength }, (_, index) => Math.max(0.03, Math.min(1, baseline * 0.55 + (((hash + index * 17) % 100) / 100) * 0.45)));
}

function pushHistory(values: number[], value: number, length: number): number[] {
  return [...values.slice(-(length - 1)), value];
}

function padHistory(values: number[], length: number): number[] {
  if (values.length >= length) return values.slice(-length);
  return [...Array.from({ length: length - values.length }, () => 0.04), ...values];
}

function sortAgents(a: AgentRecord, b: AgentRecord) {
  return b.timestamps.lastSeenAt.localeCompare(a.timestamps.lastSeenAt);
}

function formatClock() {
  return new Date().toLocaleTimeString("en-GB");
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function readCachedSnapshot(): DashboardSnapshot | undefined {
  try {
    const raw = localStorage.getItem(snapshotCacheKey);
    return raw ? JSON.parse(raw) as DashboardSnapshot : undefined;
  } catch {
    return undefined;
  }
}

function cacheSnapshot(snapshot: DashboardSnapshot) {
  try {
    localStorage.setItem(snapshotCacheKey, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

createRoot(document.getElementById("root")!).render(<App />);
