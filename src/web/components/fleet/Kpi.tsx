export function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "working" | "waiting" | "muted" }) {
  return (
    <article className={`kpi ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
