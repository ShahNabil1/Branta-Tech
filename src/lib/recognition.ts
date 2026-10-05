/** Shared recognition types + default public labels. The label states the real relationship — never upgrade it. */
export const RECOGNITION_TYPES = [
  { value: "funding", label: "Funding", display: "Funded by" },
  { value: "award", label: "Award", display: "Awarded by" },
  { value: "champion", label: "Champion", display: "Champion" },
  { value: "certification", label: "Certification", display: "Certified by" },
  { value: "recognition", label: "Recognition", display: "Recognized by" },
  { value: "partnership", label: "Partnership", display: "Partner" },
] as const;
export type RecognitionType = (typeof RECOGNITION_TYPES)[number]["value"];
export const defaultLabel = (t: string) => RECOGNITION_TYPES.find((x) => x.value === t)?.display ?? "Recognition";
/** Logos: https URLs or site-relative asset paths only. */
export const isLogoUrl = (u: string) => /^https:\/\/\S+$/.test(u) || /^\/[^/\s]\S*$/.test(u);
