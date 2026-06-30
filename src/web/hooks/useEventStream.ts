import React from "react";
import { createEventStream } from "@/api/stream";
import { useFleetStore } from "@/store/fleetStore";

/** Subscribes to the harness SSE stream and routes events into the store. */
export function useEventStream(): void {
  React.useEffect(() => {
    const store = useFleetStore.getState();
    return createEventStream({
      onOpen: () => void store.refresh(),
      onStatus: (status) => store.setServerStatus(status),
      onEvent: (event) => store.prependEvent(event),
      onConclusion: (conclusion) => store.addConclusion(conclusion),
      onAgents: (agents) => store.setAgents(agents),
      onAgent: (agent) => store.upsertAgent(agent),
      onTasks: (tasks) => store.setTasks(tasks),
      onDashboard: (dashboard) => store.setDashboard(dashboard),
    });
  }, []);
}
