/**
 * Structured rich text (client-safe). Content is stored as { blocks: Block[] } — never raw HTML.
 * Inline formatting is a tiny markup: **bold**, *italic*, [label](https://url). Rendered as React
 * elements only, so there is nothing to sanitize and no way to inject scripts.
 */
export type Block =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; url: string; alt: string; caption?: string };

export const BLOCK_TYPES = ["paragraph", "heading", "quote", "list", "image"] as const;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const isHttps = (u: string) => /^https:\/\/[^\s"<>]+$/.test(u.trim());

/** Validates any JSON into a safe block list; unknown or broken blocks are dropped. */
export function parseBlocks(raw: unknown): Block[] {
  const list = Array.isArray(obj(raw)["blocks"]) ? (obj(raw)["blocks"] as unknown[]) : Array.isArray(raw) ? raw : [];
  const out: Block[] = [];
  for (const b of list.slice(0, 400)) {
    const o = obj(b);
    const t = str(o["type"]);
    if (t === "heading" && str(o["text"]).trim()) out.push({ type: "heading", level: o["level"] === 3 ? 3 : 2, text: str(o["text"]) });
    else if (t === "paragraph" && str(o["text"]).trim()) out.push({ type: "paragraph", text: str(o["text"]) });
    else if (t === "quote" && str(o["text"]).trim()) out.push({ type: "quote", text: str(o["text"]), cite: str(o["cite"]) || undefined });
    else if (t === "list") {
      const items = (Array.isArray(o["items"]) ? o["items"] : []).map(str).filter((s) => s.trim());
      if (items.length) out.push({ type: "list", ordered: o["ordered"] === true, items });
    } else if (t === "image" && isHttps(str(o["url"]))) out.push({ type: "image", url: str(o["url"]).trim(), alt: str(o["alt"]), caption: str(o["caption"]) || undefined });
  }
  return out;
}

export type Inline = { kind: "text" | "bold" | "italic"; text: string } | { kind: "link"; text: string; href: string };

const SAFE_HREF = (h: string) => /^(https?:\/\/|mailto:|\/(?!\/))[^\s"<>]*$/.test(h);

/** Splits a line into inline tokens. Links with unsafe targets fall back to plain text. */
export function parseInline(text: string): Inline[] {
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1]) out.push({ kind: "bold", text: m[1] });
    else if (m[2]) out.push({ kind: "italic", text: m[2] });
    else if (m[3] && m[4]) out.push(SAFE_HREF(m[4]) ? { kind: "link", text: m[3], href: m[4] } : { kind: "text", text: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Rough reading time from blocks. */
export function readingMinutes(blocks: Block[]) {
  const words = blocks.map((b) => (b.type === "list" ? b.items.join(" ") : "text" in b ? b.text : "")).join(" ").split(/\s+/).filter(Boolean).length;
  return words ? Math.max(1, Math.round(words / 220)) : 0;
}
