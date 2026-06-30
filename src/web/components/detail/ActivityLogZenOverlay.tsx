import { ActivityLogRow } from "@/components/detail/ActivityLogRow";
import type { FleetAgent, HarnessEventRecord } from "@/types/view";

export function ActivityLogZenOverlay({ agent, events, onExit }: { agent: FleetAgent; events: HarnessEventRecord[]; onExit: () => void }) {
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
          {events.map((event) => (
            <ActivityLogRow key={event.id} event={event} zen />
          ))}
        </div>
      </div>
    </section>
  );
}
