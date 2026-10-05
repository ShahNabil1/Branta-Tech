/**
 * Deterministic intent matcher for Branta Assistant (no AI model, no external API).
 * Scores: exact phrase > whole-phrase inside the message > token overlap, plus small priority bonus.
 */
export type MatchIntent = { id: string; key: string; priority: number; phrases: { phrase: string; lang: string }[] };
export type MatchResult = { key: string; id: string; score: number };

const BN = /[\u0980-\u09FF]/g;

export function normalize(s: string) {
  return s.normalize("NFKC").toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ").trim();
}

/** "bn" when most letters are Bangla script; "en" otherwise (Banglish is matched via phrases). */
export function detectLang(s: string): "bn" | "en" {
  const letters = s.replace(/[^\p{L}]/gu, "").length || 1;
  return (s.match(BN)?.length ?? 0) / letters > 0.3 ? "bn" : "en";
}

const tokens = (s: string) => s.split(" ").filter(Boolean);

export function phraseScore(msg: string, phrase: string): number {
  const p = normalize(phrase);
  if (!p) return 0;
  if (msg === p) return 100;
  const pt = tokens(p);
  if (` ${msg} `.includes(` ${p} `) || (BN.test(p) && msg.includes(p))) return 30 + 8 * pt.length;
  BN.lastIndex = 0;
  if (pt.length < 2) return 0;
  const mt = new Set(tokens(msg));
  const hit = pt.filter((t) => mt.has(t)).length;
  return hit / pt.length >= 0.6 ? Math.round(18 * (hit / pt.length)) + 4 * hit : 0;
}

export function matchIntents(text: string, intents: MatchIntent[]): MatchResult[] {
  const msg = normalize(text);
  if (!msg) return [];
  const out: MatchResult[] = [];
  for (const it of intents) {
    const scores = it.phrases.map((p) => phraseScore(msg, p.phrase)).filter((s) => s > 0).sort((a, b) => b - a);
    if (!scores.length) continue;
    const score = scores[0]! + Math.min(15, 4 * (scores.length - 1)) + Math.min(5, it.priority * 0.5);
    out.push({ key: it.key, id: it.id, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export const MATCH_THRESHOLD = 26;
export const PORTFOLIO_WORDS = ["work", "portfolio", "projects", "project", "samples", "case", "কাজ", "পোর্টফোলিও"];
