import type { FleetAgent } from "@/types/view";

export function Progress({ agent }: { agent: FleetAgent }) {
  return (
    <section className="progress-block">
      <div>
        <span>Step {agent.step} / {agent.total}</span>
        <strong>{agent.progress}%</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${agent.progress}%` }} />
      </div>
    </section>
  );
}
