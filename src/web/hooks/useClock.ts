import React from "react";
import { useFleetStore } from "@/store/fleetStore";
import { formatClock } from "@/lib/format";

/** Ticks the header clock every second and nudges the throughput window each minute. */
export function useClock(): void {
  React.useEffect(() => {
    const clock = window.setInterval(() => useFleetStore.getState().tickClock(formatClock()), 1000);
    const throughput = window.setInterval(() => useFleetStore.getState().pushEventTick(0), 60_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(throughput);
    };
  }, []);
}
