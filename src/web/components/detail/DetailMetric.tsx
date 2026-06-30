export function DetailMetric({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <article className="detail-metric">
      <span>{label}</span>
      <strong className={accent ? "accent" : ""}>{value}</strong>
    </article>
  );
}
