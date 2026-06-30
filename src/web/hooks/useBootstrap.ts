import React from "react";
import { useFleetStore } from "@/store/fleetStore";

/** Hydrates from the localStorage snapshot, then fetches a fresh snapshot. */
export function useBootstrap(): void {
  React.useEffect(() => {
    const store = useFleetStore.getState();
    store.hydrateFromCache();
    void store.refresh();
  }, []);
}
