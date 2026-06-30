import type { FleetState } from "@/types/view";

export function StatusPill({ state, compact = false }: { state: FleetState; compact?: boolean }) {
  const label = state === "waiting" ? "Waiting on input" : state[0].toUpperCase() + state.slice(1);
  return <span className={`status-pill ${state} ${compact ? "compact" : ""}`}>{label}</span>;
}
