/** Video loading priority shared by CMS parsing and the BrantaVideo engine. */
export type VideoPriority = "critical" | "high" | "lazy";
export const PRIORITY_OPTIONS: [VideoPriority | "auto", string][] = [["auto", "Automatic"], ["critical", "Load immediately"], ["high", "Load early"], ["lazy", "Load when needed"]];
export const parsePriority = (v: unknown): VideoPriority | "auto" => (v === "critical" || v === "high" || v === "lazy" ? v : "auto");
export const resolvePriority = (v: VideoPriority | "auto" | undefined, fallback: VideoPriority): VideoPriority => (!v || v === "auto" ? fallback : v);

