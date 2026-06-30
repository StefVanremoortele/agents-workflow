import React from "react";
import { useFleetStore } from "@/store/fleetStore";
import { StatusPill } from "@/components/common/StatusPill";
import { Sparkline } from "@/components/common/Sparkline";
import type { FleetAgent } from "@/types/view";

export function AgentTable({ agents }: { agents: FleetAgent[] }) {
  return (
    <section className="fleet-table">
      <div className="table-row table-head">
        <span>Agent</span>
        <span>Status</span>
        <span>Current task</span>
        <span>Progress</span>
        <span>Elapsed</span>
        <span>ETA</span>
        <span>Activity</span>
        <span>Events</span>
      </div>
      {agents.map((agent) => (
        <AgentTableRow key={agent.id} agent={agent} />
      ))}
    </section>
  );
}

function AgentTableRow({ agent }: { agent: FleetAgent }) {
  const renameAgent = useFleetStore((state) => state.renameAgent);
  const openAgent = useFleetStore((state) => state.openAgent);
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(agent.name);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!editing) setName(agent.name);
  }, [agent.name, editing]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === agent.name) {
      setEditing(false);
      setName(agent.name);
      return;
    }
    setSaving(true);
    try {
      await renameAgent(agent.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="table-row"
      onClick={() => openAgent(agent.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") openAgent(agent.id);
      }}
    >
      <div className="table-agent-name" onClick={(event) => event.stopPropagation()}>
        {editing ? (
          <input
            value={name}
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveName();
              if (event.key === "Escape") {
                setName(agent.name);
                setEditing(false);
              }
            }}
            aria-label={`Rename ${agent.name}`}
            autoFocus
          />
        ) : (
          <>
            <strong>{agent.name}</strong>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setEditing(true);
              }}
              aria-label={`Rename ${agent.name}`}
              title="Rename agent"
            >
              ✎
            </button>
          </>
        )}
      </div>
      <StatusPill state={agent.state} compact />
      <span className="task-cell">{agent.task}</span>
      <div className="table-progress">
        <div><span style={{ width: `${agent.progress ?? 0}%` }} /></div>
        <b>{agent.progress !== null ? `${agent.progress}%` : "—"}</b>
      </div>
      <span>{agent.elapsed}</span>
      <span>{agent.eta}</span>
      <Sparkline values={agent.hist.slice(-18)} state={agent.state} className="table-spark" />
      <span className="events-cell">{agent.events}</span>
    </div>
  );
}
