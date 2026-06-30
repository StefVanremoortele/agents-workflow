import type { FleetState } from "@/types/view";

export function Sparkline({ values, state, className = "" }: { values: number[]; state: FleetState; className?: string }) {
  const normalized = values.length ? values : [0];
  const width = className.includes("global") ? 160 : className.includes("table") ? 96 : 260;
  const height = className.includes("table") ? 26 : 40;
  const points = normalized
    .map((value, index) => `${(index / Math.max(1, normalized.length - 1)) * width},${height - Math.max(0.04, value) * (height - 4) - 2}`)
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg className={`sparkline ${state} ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} />
      <polyline points={points} />
    </svg>
  );
}
