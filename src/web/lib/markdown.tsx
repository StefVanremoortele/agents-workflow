import React from "react";

export function MarkdownContent({ content, compact = false, className = "" }: { content: string; compact?: boolean; className?: string }) {
  const blocks = parseMarkdownBlocks(content);
  return <div className={`markdown-content ${compact ? "compact" : ""} ${className}`.trim()}>{blocks.map(renderMarkdownBlock)}</div>;
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string }
  | { type: "quote"; text: string };

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let code: string[] | undefined;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = undefined;
      } else {
        flushParagraph();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    const listMatch = line.match(/^\s*((?:[-*+])|(?:\d+\.))\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = /\d+\./.test(listMatch[1]);
      const items = [listMatch[2]];
      while (index + 1 < lines.length) {
        const next = lines[index + 1].match(/^\s*((?:[-*+])|(?:\d+\.))\s+(.+)$/);
        if (!next || /\d+\./.test(next[1]) !== ordered) break;
        items.push(next[2]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      blocks.push({ type: "quote", text: quote[1] });
      continue;
    }

    paragraph.push(line);
  }

  if (code) blocks.push({ type: "code", text: code.join("\n") });
  flushParagraph();
  return blocks;
}

export function renderMarkdownBlock(block: MarkdownBlock, index: number): React.ReactNode {
  if (block.type === "heading") {
    const Tag = `h${Math.min(4, Math.max(3, block.level + 2))}` as keyof React.JSX.IntrinsicElements;
    return <Tag key={index}>{renderMarkdownInline(block.text)}</Tag>;
  }
  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return <Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderMarkdownInline(item)}</li>)}</Tag>;
  }
  if (block.type === "code") return <pre key={index}><code>{block.text}</code></pre>;
  if (block.type === "quote") return <blockquote key={index}>{renderMarkdownInline(block.text)}</blockquote>;
  return <p key={index}>{renderMarkdownInline(block.text)}</p>;
}

export function renderMarkdownInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) nodes.push(<em key={nodes.length}>{token.slice(1, -1)}</em>);
    else if (token.startsWith("`")) nodes.push(<code key={nodes.length}>{token.slice(1, -1)}</code>);
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      nodes.push(<a key={nodes.length} href={link?.[2] ?? "#"} target="_blank" rel="noreferrer">{link?.[1] ?? token}</a>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
