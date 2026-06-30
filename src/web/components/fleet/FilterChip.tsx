export function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`filter-chip ${active ? "active" : ""}`} onClick={onClick}>
      {label}
      <span>{count}</span>
    </button>
  );
}
