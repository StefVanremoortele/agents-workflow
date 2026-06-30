import type { FleetAgent } from "@/types/view";

export function Progress({ agent }: { agent: FleetAgent }) {
  const hasProgress = agent.progress !== null;
  const hasSteps = agent.step !== null && agent.total !== null && agent.total > 0;

  return (
    <section className="progress-block">
      <div>
        <span>{hasSteps ? `Step ${agent.step} / ${agent.total}` : "Progress"}</span>
        <strong>{hasProgress ? `${agent.progress}%` : "—"}</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${hasProgress ? agent.progress : 0}%` }} />
      </div>
    </section>
  );
}
