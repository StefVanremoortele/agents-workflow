export function formatClock(): string {
  return new Date().toLocaleTimeString("en-GB");
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatTime(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB");
}

export function shortId(id: string): string {
  return id.length > 14 ? id.slice(-12) : id;
}

export function eventKind(type: string, severity?: string): string {
  if (severity === "error" || severity === "critical") return "ERR";
  if (type.includes("tool")) return "TOOL";
  if (type.includes("message") || type.includes("edit")) return "EDIT";
  if (type.includes("blocked") || type.includes("waiting")) return "WAIT";
  if (type.includes("completed") || type.includes("stopped")) return "DONE";
  if (type.includes("task")) return "RUN";
  return "INFO";
}
