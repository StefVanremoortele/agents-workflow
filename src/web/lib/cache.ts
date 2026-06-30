import { snapshotCacheKey } from "@/config";
import type { DashboardSnapshot } from "@/types/view";

export function readCachedSnapshot(): DashboardSnapshot | undefined {
  try {
    const raw = localStorage.getItem(snapshotCacheKey);
    return raw ? (JSON.parse(raw) as DashboardSnapshot) : undefined;
  } catch {
    return undefined;
  }
}

export function cacheSnapshot(snapshot: DashboardSnapshot): void {
  try {
    localStorage.setItem(snapshotCacheKey, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota/private mode failures.
  }
}
