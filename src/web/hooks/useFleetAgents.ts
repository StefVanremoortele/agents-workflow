import React from "react";
import { useFleetStore } from "@/store/fleetStore";
import { toFleetAgent } from "@/lib/derive";
import { normalizeActivity, seedHistory } from "@/lib/history";
import type { FleetAgent, HarnessEventRecord } from "@/types/view";

/** Derives UI-friendly FleetAgent records from raw store state. */
export function useFleetAgents(): FleetAgent[] {
  const agents = useFleetStore((state) => state.agents);
  const tasks = useFleetStore((state) => state.tasks);
  const agentHistories = useFleetStore((state) => state.agentHistories);
  const events = useFleetStore((state) => state.events);

  const eventsByAgent = React.useMemo(() => {
    const grouped: Record<string, HarnessEventRecord[]> = {};
    for (const event of events) {
      grouped[event.source.id] = [...(grouped[event.source.id] ?? []), event];
    }
    return grouped;
  }, [events]);

  return React.useMemo(
    () =>
      agents.map((agent) =>
        toFleetAgent(
          agent,
          tasks,
          agentHistories[agent.id] ?? seedHistory(agent.id, normalizeActivity(agent.stats.eventCount)),
          eventsByAgent[agent.id] ?? [],
        ),
      ),
    [agents, tasks, agentHistories, eventsByAgent],
  );
}
