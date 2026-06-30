import { MarkdownContent } from "@/lib/markdown";
import { eventKind } from "@/lib/format";
import { formatTime } from "@/lib/format";
import type { HarnessEventRecord } from "@/types/view";

export function ActivityLogRow({ event, zen = false }: { event: HarnessEventRecord; zen?: boolean }) {
  const kind = eventKind(event.event.type, event.event.severity);
  const detail = event.event.conclusion ?? event.event.content;
  return (
    <div className={`log-row ${detail ? "with-detail" : ""} ${zen ? "zen-row" : ""}`}>
      <time>{formatTime(event.timestamp)}</time>
      <b className={kind.toLowerCase()}>{kind}</b>
      <div className="log-message">
        <strong>{event.event.title ?? event.event.type}</strong>
        {detail ? <MarkdownContent content={detail} compact={!zen} /> : null}
      </div>
    </div>
  );
}
