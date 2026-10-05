/**
 * Structured application records (client-safe): education, experience, skills, languages.
 * Sent by the wizard as one JSON field, validated by submitApplication, stored in job_applications.extra.
 */
import { z } from "zod";

const t = (n: number) => z.string().trim().max(n).default("");
export const EducationSchema = z.object({
  institution: t(200), level: t(120), field: t(160), major: t(160), start_year: t(4), end_year: t(4), is_current: z.boolean().default(false), result: t(40), description: t(1000),
});
export const ExperienceSchema = z.object({
  company: t(200), title: t(160), employment_type: t(60), start_date: t(10), end_date: t(10), is_current: z.boolean().default(false), responsibilities: t(2000), achievements: t(1000),
});
export const SkillSchema = z.object({ name: t(80), level: t(20) });
export const LanguageSchema = z.object({ language: t(60), proficiency: t(30) });
export const RecordsSchema = z.object({
  education: z.array(EducationSchema).max(15).default([]),
  has_experience: z.enum(["yes", "no", ""]).default(""),
  experience: z.array(ExperienceSchema).max(20).default([]),
  skills: z.array(SkillSchema).max(50).default([]),
  languages: z.array(LanguageSchema).max(15).default([]),
});
export type Education = z.infer<typeof EducationSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Records = z.infer<typeof RecordsSchema>;

export const emptyEducation = (): Education => ({ institution: "", level: "", field: "", major: "", start_year: "", end_year: "", is_current: false, result: "", description: "" });
export const emptyExperience = (): Experience => ({ company: "", title: "", employment_type: "", start_date: "", end_date: "", is_current: false, responsibilities: "", achievements: "" });
export const emptyRecords = (): Records => ({ education: [], has_experience: "", experience: [], skills: [], languages: [] });

/** Per-record problems (empty array = fine). Used by the wizard and the server. */
export function recordErrors(r: Records): Record<string, string> {
  const e: Record<string, string> = {};
  const yr = (s: string) => !s || /^\d{4}$/.test(s);
  r.education.forEach((x, i) => {
    if (!x.institution) e[`education.${i}.institution`] = "Enter the institution";
    if (!x.level) e[`education.${i}.level`] = "Choose a level";
    if (!yr(x.start_year)) e[`education.${i}.start_year`] = "Use a 4-digit year";
    if (!yr(x.end_year)) e[`education.${i}.end_year`] = "Use a 4-digit year";
  });
  if (r.has_experience === "yes") r.experience.forEach((x, i) => {
    if (!x.company) e[`experience.${i}.company`] = "Enter the company";
    if (!x.title) e[`experience.${i}.title`] = "Enter the job title";
    if (x.start_date && !/^\d{4}-\d{2}$/.test(x.start_date)) e[`experience.${i}.start_date`] = "Choose a month";
    if (x.end_date && !/^\d{4}-\d{2}$/.test(x.end_date)) e[`experience.${i}.end_date`] = "Choose a month";
  });
  r.skills.forEach((x, i) => { if (!x.name) e[`skills.${i}.name`] = "Enter a skill"; });
  r.languages.forEach((x, i) => { if (!x.language) e[`languages.${i}.language`] = "Enter a language"; });
  return e;
}

// ---------- Reading stored applications (HR view + export) ----------
type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === "object" && !Array.isArray(v) ? (v as R) : {});

export type StoredApplication = { extra: unknown; answers: unknown };
export function readRecords(extra: unknown): Records & { legacy_education: string; legacy_experience: string } {
  const x = obj(extra);
  const parsed = RecordsSchema.safeParse({ education: x["education_records"], has_experience: x["has_experience"] ?? "", experience: x["experience_records"], skills: x["skills"], languages: x["languages"] });
  const base = parsed.success ? parsed.data : emptyRecords();
  return { ...base, legacy_education: typeof x["education"] === "string" ? (x["education"] as string) : "", legacy_experience: typeof x["experience"] === "string" ? (x["experience"] as string) : "" };
}
export const extraText = (extra: unknown, k: string) => { const v = obj(extra)[k]; return typeof v === "string" ? v : ""; };

const LEVEL_RANK = ["phd", "doctor", "master", "bachelor", "honours", "degree", "diploma", "hsc", "a level", "ssc", "o level"];
const rank = (lvl: string) => { const s = lvl.toLowerCase(); const i = LEVEL_RANK.findIndex((k) => s.includes(k)); return i === -1 ? 99 : i; };
export function highestEducation(r: Records): string {
  const e = [...r.education].sort((a, b) => rank(a.level) - rank(b.level))[0];
  return e ? [e.level, e.field].filter(Boolean).join(" in ") + (e.institution ? `, ${e.institution}` : "") : "";
}
const months = (s: string) => { const m = /^(\d{4})-(\d{2})$/.exec(s); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null; };
/** Total months across experience records with valid dates (overlaps not merged). */
export function totalExperienceMonths(r: Records, now = new Date()): number | null {
  if (r.has_experience === "no") return 0;
  let total = 0, any = false;
  const cur = now.getFullYear() * 12 + now.getMonth();
  for (const x of r.experience) {
    const a = months(x.start_date); const b = x.is_current ? cur : months(x.end_date);
    if (a !== null && b !== null && b >= a) { total += b - a + 1; any = true; }
  }
  return any ? total : null;
}
export function formatMonths(m: number | null): string {
  if (m === null) return "";
  if (m === 0) return "No experience";
  const y = Math.floor(m / 12), mo = m % 12;
  return [y && `${y} yr${y > 1 ? "s" : ""}`, mo && `${mo} mo`].filter(Boolean).join(" ");
}
export const topSkills = (r: Records, n = 4) => r.skills.slice(0, n).map((s) => s.name).filter(Boolean);
export const yearSpan = (a: string, b: string, cur: boolean) => [a, cur ? "Present" : b].filter(Boolean).join("–");

export const DOC_KEYS = ["cover_letter_file", "portfolio_file", "certificates", "transcript", "national_id", "other_document", "photo"] as const;
export const DOC_LABEL: Record<string, string> = { resume: "CV / Resume", cover_letter_file: "Cover letter", portfolio_file: "Portfolio", certificates: "Certificates", transcript: "Academic transcript", national_id: "National ID", other_document: "Other document", photo: "Profile photo" };
