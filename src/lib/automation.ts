/** Shared parsing for the Home "automation_showcase" section config. Client-safe. */
export const NODE_KINDS = ["input", "ai", "system", "action", "result"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
export type FlowNode = { label: string; kind: NodeKind };
export type UseCase = { key: string; label: string; description: string; outcome: string; nodes: FlowNode[] };
export type AutomationConfig = { default_key: string; use_cases: UseCase[]; outcomes: string[] };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const MAX_NODES = 6;

export function parseAutomationConfig(raw: unknown): AutomationConfig {
  const c = obj(raw);
  const use_cases: UseCase[] = (Array.isArray(c["use_cases"]) ? c["use_cases"] : [])
    .map((u, i) => {
      const o = obj(u);
      const nodes = (Array.isArray(o["nodes"]) ? o["nodes"] : [])
        .map((n) => {
          const no = obj(n);
          const kind = NODE_KINDS.includes(no["kind"] as NodeKind) ? (no["kind"] as NodeKind) : "system";
          return { label: str(no["label"]), kind };
        })
        .filter((n) => n.label)
        .slice(0, MAX_NODES);
      return { key: str(o["key"]) || `case-${i + 1}`, label: str(o["label"]), description: str(o["description"]), outcome: str(o["outcome"]), nodes };
    })
    .filter((u) => u.label && u.nodes.length >= 2)
    .slice(0, 4);
  const outcomes = (Array.isArray(c["outcomes"]) ? c["outcomes"] : []).map(str).filter(Boolean);
  const dk = str(c["default_key"]);
  return { default_key: use_cases.some((u) => u.key === dk) ? dk : use_cases[0]?.key ?? "", use_cases, outcomes };
}
