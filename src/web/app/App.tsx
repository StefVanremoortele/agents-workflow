import React from "react";
import { useFleetStore } from "@/store/fleetStore";
import { useFleetAgents } from "@/hooks/useFleetAgents";
import { useBootstrap } from "@/hooks/useBootstrap";
import { useEventStream } from "@/hooks/useEventStream";
import { useClock } from "@/hooks/useClock";
import { FleetDashboard } from "@/components/fleet/FleetDashboard";
import { AgentDetailView } from "@/components/detail/AgentDetailView";

export function App() {
  useBootstrap();
  useEventStream();
  useClock();

  const fleetAgents = useFleetAgents();
  const selectedAgentId = useFleetStore((state) => state.selectedAgentId);
  const events = useFleetStore((state) => state.events);
  const conclusions = useFleetStore((state) => state.conclusions);
  const detailNav = useFleetStore((state) => state.detailNav);
  const closeAgent = useFleetStore((state) => state.closeAgent);
  const navigateAgent = useFleetStore((state) => state.navigateAgent);

  const selectedIndex = React.useMemo(
    () => (selectedAgentId ? fleetAgents.findIndex((agent) => agent.id === selectedAgentId) : -1),
    [fleetAgents, selectedAgentId],
  );
  const selectedAgent = selectedIndex >= 0 ? fleetAgents[selectedIndex] : undefined;

  if (selectedAgent) {
    return (
      <AgentDetailView
        agent={selectedAgent}
        events={events.filter((event) => event.source.id === selectedAgent.id)}
        conclusion={conclusions.find((item) => item.sourceId === selectedAgent.id)}
        onBack={closeAgent}
        onNavigate={navigateAgent}
        position={selectedIndex >= 0 ? selectedIndex + 1 : 1}
        total={fleetAgents.length}
        navFrom={detailNav.from}
        navParity={detailNav.parity}
      />
    );
  }

  return <FleetDashboard />;
}
