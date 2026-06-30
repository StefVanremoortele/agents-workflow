import React from "react";
import { StatusPill } from "@/components/common/StatusPill";
import { Sparkline } from "@/components/common/Sparkline";
import { DetailMetric } from "@/components/detail/DetailMetric";
import { DetailRow } from "@/components/detail/DetailRow";
import { ActivityLogRow } from "@/components/detail/ActivityLogRow";
import { ActivityLogZenOverlay } from "@/components/detail/ActivityLogZenOverlay";
import { ConclusionZenOverlay } from "@/components/detail/ConclusionZenOverlay";
import { MarkdownContent } from "@/lib/markdown";
import { buildTaskSteps } from "@/lib/derive";
import { dedupeLogEvents, fallbackEvents } from "@/lib/logEvents";
import { formatTime, shortId } from "@/lib/format";
import type { ConclusionRecord, FleetAgent, HarnessEventRecord } from "@/types/view";

export function AgentDetailView({
  agent,
  events,
  conclusion,
  onBack,
  onNavigate,
  position,
  total,
  navFrom,
  navParity,
}: {
  agent: FleetAgent;
  events: HarnessEventRecord[];
  conclusion?: ConclusionRecord;
  onBack: () => void;
  onNavigate: (delta: -1 | 1) => void;
  position: number;
  total: number;
  navFrom: string;
  navParity: number;
}) {
  const [zen, setZen] = React.useState(false);
  const [conclusionZen, setConclusionZen] = React.useState(false);
  const startedAt = agent.raw.currentTask?.startedAt ?? agent.raw.timestamps.firstSeenAt ?? agent.raw.timestamps.lastSeenAt;
  const steps = buildTaskSteps(agent);
  const hasProgress = agent.progress !== null;
  const hasSteps = agent.step !== null && agent.total !== null && agent.total > 0;
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
        <div className="detail-actions">
          {agent.state === "waiting" ? <button className="resume-action">Respond & Resume</button> : null}
          {agent.state === "working" ? <button>Pause</button> : null}
          <button>Stop</button>
        </div>
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
          <DetailMetric label="Progress" value={hasProgress ? `${agent.progress}%` : "—"} accent />
          <DetailMetric label="Events" value={agent.events} />
        </section>

        <section className="detail-grid">
          <div className="detail-maincol">
            <article className="detail-panel current-task-panel">
              <div className="detail-panel-label">Current task</div>
              <h2>{agent.task}</h2>
              {agent.raw.currentTask?.summary ? <MarkdownContent content={agent.raw.currentTask.summary} className="task-summary" /> : null}
              <div className="detail-progress-head">
                <span>{hasSteps ? `Step ${agent.step} / ${agent.total}` : "Progress not reported"}</span>
                <strong>{hasProgress ? `${agent.progress}%` : "—"}</strong>
              </div>
              <div className="progress-track"><span style={{ width: `${agent.progress ?? 0}%` }} /></div>
              {steps.length > 0 ? (
                <ol className="task-steps">
                  {steps.map((step) => (
                    <li key={step.label} className={step.state}>
                      <span /> <p>{step.label}</p>
                      <em>{step.state === "done" ? "Done" : step.state === "active" ? "In progress" : ""}</em>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="task-summary">No task step telemetry has been reported for this task. Use the activity log below for the real event stream.</p>
              )}
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
              {logEvents.slice(0, 12).map((event) => (
                <ActivityLogRow key={event.id} event={event} />
              ))}
            </div>
          </article>
        </section>
      </section>
      {zen ? <ActivityLogZenOverlay agent={agent} events={logEvents} onExit={() => setZen(false)} /> : null}
      {conclusionZen && conclusion ? <ConclusionZenOverlay agent={agent} conclusion={conclusion} onExit={() => setConclusionZen(false)} /> : null}
    </main>
  );
}
