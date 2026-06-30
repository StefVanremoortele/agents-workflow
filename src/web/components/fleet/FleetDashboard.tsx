import React from "react";
import { globalHistLength } from "@/config";
import { useFleetStore } from "@/store/fleetStore";
import { useFleetAgents } from "@/hooks/useFleetAgents";
import { padHistory } from "@/lib/history";
import { Kpi } from "@/components/fleet/Kpi";
import { FilterChip } from "@/components/fleet/FilterChip";
import { AgentCard } from "@/components/fleet/AgentCard";
import { AgentTable } from "@/components/fleet/AgentTable";
import { Sparkline } from "@/components/common/Sparkline";

export function FleetDashboard() {
  const fleetAgents = useFleetAgents();
  const dashboard = useFleetStore((state) => state.dashboard);
  const view = useFleetStore((state) => state.view);
  const filter = useFleetStore((state) => state.filter);
  const showOffline = useFleetStore((state) => state.showOffline);
  const live = useFleetStore((state) => state.live);
  const clock = useFleetStore((state) => state.clock);
  const serverStatus = useFleetStore((state) => state.serverStatus);
  const eventTicks = useFleetStore((state) => state.eventTicks);
  const setView = useFleetStore((state) => state.setView);
  const setFilter = useFleetStore((state) => state.setFilter);
  const toggleOffline = useFleetStore((state) => state.toggleOffline);
  const toggleLive = useFleetStore((state) => state.toggleLive);
  const refresh = useFleetStore((state) => state.refresh);

  const counts = React.useMemo(
    () => ({
      all: fleetAgents.length,
      working: fleetAgents.filter((agent) => agent.state === "working").length,
      waiting: fleetAgents.filter((agent) => agent.state === "waiting").length,
      idle: fleetAgents.filter((agent) => agent.state === "idle").length,
      offline: fleetAgents.filter((agent) => agent.state === "offline").length,
    }),
    [fleetAgents],
  );

  const visibleAgents = (filter === "all" ? fleetAgents : fleetAgents.filter((agent) => agent.state === filter)).filter(
    (agent) => showOffline || agent.state !== "offline",
  );

  const epm = React.useMemo(() => eventTicks.reduce((sum, value) => sum + value, 0), [eventTicks]);
  const gspark = React.useMemo(() => padHistory(eventTicks.map((value) => Math.min(1, value / 20)), globalHistLength), [eventTicks]);
  const avgProgress = React.useMemo(() => {
    const workingWithProgress = fleetAgents.filter((agent) => agent.state === "working" && agent.progress !== null);
    if (workingWithProgress.length === 0) return null;
    return Math.round(workingWithProgress.reduce((sum, agent) => sum + (agent.progress ?? 0), 0) / workingWithProgress.length);
  }, [fleetAgents]);

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
            <button className={`live-pill ${live ? "live" : "paused"}`} onClick={toggleLive}>
              <span /> {live ? "LIVE" : "PAUSED"}
            </button>
          </div>
        </div>
      </header>

      <section className="kpi-strip">
        <Kpi label="Working" value={counts.working} tone="working" />
        <Kpi label="Waiting on input" value={counts.waiting} tone="waiting" />
        <Kpi label="Idle / offline" value={counts.idle + counts.offline} tone="muted" />
        <Kpi label="Avg progress" value={avgProgress !== null ? `${avgProgress}%` : "—"} />
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
          <button className="refresh-button" onClick={() => void refresh()}>Refresh</button>
        </div>
      </section>

      <section className="filter-chips" aria-label="Agent status filters">
        <FilterChip label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterChip label="Working" count={counts.working} active={filter === "working"} onClick={() => setFilter("working")} />
        <FilterChip label="Waiting" count={counts.waiting} active={filter === "waiting"} onClick={() => setFilter("waiting")} />
        <FilterChip label="Idle" count={counts.idle} active={filter === "idle"} onClick={() => setFilter("idle")} />
        <FilterChip label="Offline" count={counts.offline} active={showOffline} onClick={toggleOffline} />
      </section>

      {visibleAgents.length === 0 ? (
        <section className="empty-fleet">
          <h3>No agents match this filter</h3>
          <p>Start an agent or post telemetry to <code>/events</code> to populate Fleet Control.</p>
        </section>
      ) : view === "cards" ? (
        <section className="fleet-grid">
          {visibleAgents.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} index={index} />
          ))}
        </section>
      ) : (
        <AgentTable agents={visibleAgents} />
      )}
    </main>
  );
}
