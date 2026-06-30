import { histLength } from "@/config";

export function normalizeActivity(events: number): number {
  return Math.max(0.05, Math.min(1, (events % 18) / 18));
}

export function seedHistory(seed: string, baseline: number): number[] {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) % 1009;
  return Array.from({ length: histLength }, (_, index) =>
    Math.max(0.03, Math.min(1, baseline * 0.55 + (((hash + index * 17) % 100) / 100) * 0.45)),
  );
}

export function pushHistory(values: number[], value: number, length: number): number[] {
  return [...values.slice(-(length - 1)), value];
}

export function padHistory(values: number[], length: number): number[] {
  if (values.length >= length) return values.slice(-length);
  return [...Array.from({ length: length - values.length }, () => 0.04), ...values];
}
