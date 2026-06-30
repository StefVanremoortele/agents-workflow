import React from "react";
import { useFleetStore } from "@/store/fleetStore";
import { StatusPill } from "@/components/common/StatusPill";
import { Sparkline } from "@/components/common/Sparkline";
import { Progress } from "@/components/fleet/Progress";
import { WaitingBanner } from "@/components/fleet/WaitingBanner";
import type { FleetAgent } from "@/types/view";

export function AgentCard({ agent, index }: { agent: FleetAgent; index: number }) {
  const renameAgent = useFleetStore((state) => state.renameAgent);
  const openAgent = useFleetStore((state) => state.openAgent);
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(agent.name);
  React.useEffect(() => {
    if (!editing) setName(agent.name);
  }, [agent.name, editing]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await renameAgent(agent.id, trimmed);
    setEditing(false);
  }

  return (
    <article
      className={`fleet-card ${agent.state}`}
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={() => openAgent(agent.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") openAgent(agent.id);
      }}
    >
      <div className="card-head">
        <span className="state-dot" />
        {editing ? (
          <div className="name-edit" onClick={(event) => event.stopPropagation()}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveName();
                if (event.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <button onClick={() => void saveName()}>Save</button>
          </div>
        ) : (
          <strong className="agent-name">{agent.name}</strong>
        )}
        <button
          className="rename-mini"
          onClick={(event) => {
            event.stopPropagation();
            setEditing(true);
          }}
          aria-label={`Rename ${agent.name}`}
          title="Rename agent"
        >
          ✎
        </button>
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
