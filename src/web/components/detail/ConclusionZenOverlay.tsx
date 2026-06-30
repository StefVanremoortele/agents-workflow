import { MarkdownContent } from "@/lib/markdown";
import type { ConclusionRecord, FleetAgent } from "@/types/view";

export function ConclusionZenOverlay({ agent, conclusion, onExit }: { agent: FleetAgent; conclusion: ConclusionRecord; onExit: () => void }) {
  return (
    <section className={`zen-overlay conclusion-zen ${agent.state}`} role="dialog" aria-modal="true" aria-label={`${agent.name} latest conclusion`}>
      <button className="zen-exit" onClick={onExit}><span aria-hidden="true">⛶</span> Exit</button>
      <div className="zen-inner">
        <header className="zen-header">
          <div className="zen-title-row">
            <span className="state-dot" />
            <h1>{agent.name}</h1>
            <span className="zen-label">Latest conclusion</span>
          </div>
          <p>{agent.task}</p>
        </header>
        <article className="zen-conclusion" tabIndex={0}>
          <h2>{conclusion.title ?? "Final response"}</h2>
          <MarkdownContent content={conclusion.content} />
        </article>
      </div>
    </section>
  );
}
