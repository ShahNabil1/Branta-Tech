/**
 * Structured job data (client-safe). jobs.details / jobs.seo are JSON; this module is the only
 * place that knows their shape: defaults, tolerant parsing, salary wording and the public shape.
 */
import { parseBlocks, type Block } from "./rich-text";

export const uid = () => Math.random().toString(36).slice(2, 10);

export type Item = { id: string; text: string; enabled: boolean };
export type Step = { id: string; label: string; title: string; text: string; enabled: boolean };
export type Benefit = { id: string; title: string; description: string; icon: string; enabled: boolean };
export type Skill = { id: string; name: string; level: "required" | "preferred"; enabled: boolean };
export type Language = { id: string; language: string; proficiency: string; note: string };
export type QuestionType = "short" | "long" | "number" | "yesno" | "single" | "multi" | "dropdown" | "date" | "url" | "file";
export type Question = { id: string; label: string; help: string; type: QuestionType; options: string[]; required: boolean; enabled: boolean; eligibility: boolean; eligible_answer: string };
export type FormField = { key: FormKey; enabled: boolean; required: boolean };

export const FORM_FIELDS = [
  ["phone", "Phone"], ["location", "Current address"], ["city", "City / District"], ["country", "Country"], ["dob", "Date of birth"], ["gender", "Gender"],
  ["current_status", "Current status"], ["linkedin_url", "LinkedIn URL"], ["portfolio_url", "Portfolio URL"], ["website_url", "Website URL"], ["github_url", "GitHub URL"], ["behance_url", "Behance URL"],
  ["education", "Education records"], ["experience", "Work experience records"],
  ["current_company", "Current company"], ["current_position", "Current position"], ["current_salary", "Current salary"], ["expected_salary", "Expected salary"], ["notice_period", "Notice period"], ["joining_date", "Available joining date"],
  ["skills", "Skills"], ["languages", "Languages"],
  ["resume", "CV / Resume upload"], ["cover_note", "Cover letter (text)"], ["cover_letter_file", "Cover letter file"], ["portfolio_file", "Portfolio upload"], ["certificates", "Certificates"],
  ["transcript", "Academic transcript"], ["national_id", "National ID / identification"], ["other_document", "Other supporting document"], ["photo", "Profile photo"],
] as const;
export type FormKey = (typeof FORM_FIELDS)[number][0];
export const FORM_LABEL = Object.fromEntries(FORM_FIELDS) as Record<FormKey, string>;
/** Keys stored in job_applications columns; the rest go to job_applications.extra. */
export const COLUMN_KEYS: FormKey[] = ["phone", "location", "linkedin_url", "portfolio_url", "cover_note", "resume"];
export const FILE_KEYS: FormKey[] = ["resume", "cover_letter_file", "portfolio_file", "certificates", "transcript", "national_id", "other_document", "photo"];
/** Repeatable record sections (sent as JSON, stored in extra). */
export const RECORD_KEYS: FormKey[] = ["education", "experience", "skills", "languages"];
export const CURRENT_STATUSES = ["Student", "Fresh Graduate", "Employed", "Unemployed", "Freelancer", "Other"];
export const GENDERS = ["Female", "Male", "Prefer not to say", "Other"];
export const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
/** Wizard steps and the form keys each one owns (Review is added by the wizard). */
export const WIZARD_STEPS: { id: string; title: string; keys: FormKey[] }[] = [
  { id: "personal", title: "Personal Information", keys: ["phone", "location", "city", "country", "dob", "gender", "photo", "current_status", "linkedin_url", "portfolio_url", "website_url", "github_url", "behance_url"] },
  { id: "education", title: "Education", keys: ["education"] },
  { id: "experience", title: "Work Experience", keys: ["experience", "current_company", "current_position", "current_salary", "expected_salary", "notice_period", "joining_date"] },
  { id: "skills", title: "Skills", keys: ["skills", "languages"] },
  { id: "documents", title: "Documents", keys: ["resume", "cover_note", "cover_letter_file", "portfolio_file", "certificates", "transcript", "national_id", "other_document"] },
];
const DEFAULT_ON: Partial<Record<FormKey, [boolean, boolean]>> = {
  phone: [true, true], location: [true, false], city: [true, false], country: [true, false], current_status: [true, false], linkedin_url: [true, false], portfolio_url: [true, false],
  education: [true, false], experience: [true, false], skills: [true, false], languages: [true, false], cover_note: [true, true], resume: [true, true],
};

export const SALARY_TYPES = [
  ["fixed", "Fixed salary"], ["range", "Salary range"], ["negotiable", "Negotiable"], ["undisclosed", "Not disclosed"],
  ["commission_only", "Commission only"], ["salary_commission", "Salary + commission"], ["stipend", "Stipend"], ["project", "Project based"],
] as const;
export const PERIODS = [["hour", "Hourly"], ["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["year", "Yearly"], ["project", "Project based"]] as const;
export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance", "Temporary", "Probationary"];
export const WORK_MODES = ["On-site", "Remote", "Hybrid"];
export const DEPARTMENTS = ["Sales", "Business Development", "Marketing", "Creative", "AI Production", "Software", "Operations", "Administration"];
export const SHIFTS = ["Day Shift", "Evening Shift", "Night Shift", "Flexible", "Rotational", "Custom"];
export const EDUCATION_LEVELS = ["No Specific Requirement", "SSC", "HSC", "Diploma", "Bachelor's", "Master's", "Custom"];
export const EXPERIENCE_KINDS = [["none", "No experience required"], ["freshers", "Freshers welcome"], ["minimum", "Minimum experience"], ["preferred", "Preferred experience"], ["custom", "Custom"]] as const;
export const PROFICIENCY = ["Basic", "Conversational", "Professional", "Fluent", "Native"];
export const WHO_OPTIONS = ["Students", "Fresh Graduates", "Experienced Candidates", "Career Switchers", "Freelancers", "Anyone Meeting Requirements"];
export const APPLY_METHODS = [["form", "Website application form"], ["email", "Email"], ["link", "External link"], ["whatsapp", "WhatsApp"], ["custom", "Custom instructions"]] as const;
export const QUESTION_TYPES: [QuestionType, string][] = [["short", "Short text"], ["long", "Long text"], ["number", "Number"], ["yesno", "Yes / No"], ["single", "Single choice"], ["multi", "Multiple choice"], ["dropdown", "Dropdown"], ["date", "Date"], ["url", "URL"], ["file", "File upload"]];
export const SUGGESTED_BENEFITS = ["Performance Bonus", "Sales Commission", "Festival Bonus", "Annual Salary Review", "Training & Development", "Career Growth Opportunity", "Certificate", "Experience Letter", "Flexible Working Hours", "Remote Work Opportunity", "Paid Leave", "Casual Leave", "Sick Leave", "Lunch / Meal Support", "Transport Allowance", "Mobile Allowance", "Internet Allowance", "Laptop / Device Support", "Team Outing", "Performance Recognition", "Employee Discount", "Professional Development Support", "Mentorship"];

export type JobDetails = {
  category: string; office_address: string; about: string; additional: string;
  comp: { type: string; amount: string; min: string; max: string; currency: string; period: string; text: string };
  commission: { available: boolean; type: string; percent: string; range: string; performance_bonus: boolean; target_bonus: boolean; text: string };
  benefits: Benefit[]; responsibilities: Item[]; requirements: Item[]; preferred: Item[];
  schedule: { days: string; days_off: string; start: string; end: string; hours_day: string; hours_week: string; shift: string; text: string };
  education: { level: string; field: string; notes: string };
  experience: { kind: string; min: string; unit: string; max: string; text: string };
  skills: Skill[]; languages: Language[];
  equipment: { laptop: boolean; phone: boolean; internet: boolean; headset: boolean; text: string };
  eligibility: { min_age: string; max_age: string; show_age: boolean; gender: string; authorization: string; notes: string };
  who: { options: string[]; text: string };
  offer: { heading: string; intro: string; items: Item[] };
  growth: { steps: Item[]; text: string };
  probation: { applicable: boolean; duration: string; salary: string; notes: string };
  training: { provided: boolean; duration: string; paid: boolean; text: string };
  joining: { date: string; immediate: boolean; text: string; notice: string };
  application: { no_deadline: boolean; after_deadline: "show_closed" | "auto_close"; method: string; cta_label: string; email: string; url: string; whatsapp: string; custom_text: string; auto_reject: boolean };
  form: FormField[]; questions: Question[];
  /** Job page extras — each renders only when filled in. */
  highlights: { work_on: string; learn: string; own: string };
  day: Step[]; process: Step[]; faqs: Step[]; show_team: boolean;
};
export type JobSeo = { title: string; description: string; og_title: string; og_description: string; og_image: string; canonical: string };

export const defaultForm = (): FormField[] => FORM_FIELDS.map(([key]) => ({ key, enabled: DEFAULT_ON[key]?.[0] ?? false, required: DEFAULT_ON[key]?.[1] ?? false }));
export const emptyDetails = (): JobDetails => ({
  category: "", office_address: "", about: "", additional: "",
  comp: { type: "undisclosed", amount: "", min: "", max: "", currency: "BDT", period: "month", text: "" },
  commission: { available: false, type: "percentage", percent: "", range: "", performance_bonus: false, target_bonus: false, text: "" },
  benefits: [], responsibilities: [], requirements: [], preferred: [],
  schedule: { days: "", days_off: "", start: "", end: "", hours_day: "", hours_week: "", shift: "", text: "" },
  education: { level: "", field: "", notes: "" },
  experience: { kind: "", min: "", unit: "years", max: "", text: "" },
  skills: [], languages: [],
  equipment: { laptop: false, phone: false, internet: false, headset: false, text: "" },
  eligibility: { min_age: "", max_age: "", show_age: false, gender: "", authorization: "", notes: "" },
  who: { options: [], text: "" },
  offer: { heading: "What we offer", intro: "", items: [] },
  growth: { steps: [], text: "" },
  probation: { applicable: false, duration: "", salary: "", notes: "" },
  training: { provided: false, duration: "", paid: false, text: "" },
  joining: { date: "", immediate: false, text: "", notice: "" },
  application: { no_deadline: true, after_deadline: "show_closed", method: "form", cta_label: "Apply Now", email: "", url: "", whatsapp: "", custom_text: "", auto_reject: false },
  form: defaultForm(), questions: [],
  highlights: { work_on: "", learn: "", own: "" }, day: [], process: [], faqs: [], show_team: false,
});
export const emptySeo = (): JobSeo => ({ title: "", description: "", og_title: "", og_description: "", og_image: "", canonical: "" });

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === "object" && !Array.isArray(v) ? (v as R) : {});
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v) : "");
const bool = (v: unknown) => v === true;
const arr = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 100).map(obj);
/** Copies only known keys, coercing to the type of the default. */
function shape<T extends R>(def: T, raw: unknown): T {
  const r = obj(raw);
  const out: R = {};
  for (const [k, d] of Object.entries(def)) {
    if (typeof d === "boolean") out[k] = k in r ? bool(r[k]) : d;
    else if (typeof d === "string") out[k] = k in r ? str(r[k]) : d;
    else if (Array.isArray(d)) out[k] = Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x) => typeof x === "string").slice(0, 50) : d;
  }
  return out as T;
}
const steps = (v: unknown): Step[] => arr(v).map((x) => ({ id: str(x["id"], 20) || uid(), label: str(x["label"], 60), title: str(x["title"], 200), text: str(x["text"], 1500), enabled: x["enabled"] !== false }));
const items = (v: unknown): Item[] => arr(v).map((x) => ({ id: str(x["id"], 20) || uid(), text: str(x["text"], 600), enabled: x["enabled"] !== false }));

export function parseDetails(raw: unknown): JobDetails {
  const r = obj(raw);
  const d = emptyDetails();
  const savedForm = arr(r["form"]);
  return {
    category: str(r["category"], 120), office_address: str(r["office_address"], 300), about: str(r["about"], 6000), additional: str(r["additional"], 4000),
    comp: shape(d.comp, r["comp"]), commission: shape(d.commission, r["commission"]),
    benefits: arr(r["benefits"]).map((x) => ({ id: str(x["id"], 20) || uid(), title: str(x["title"], 120), description: str(x["description"], 400), icon: str(x["icon"], 40), enabled: x["enabled"] !== false })),
    responsibilities: items(r["responsibilities"]), requirements: items(r["requirements"]), preferred: items(r["preferred"]),
    schedule: shape(d.schedule, r["schedule"]), education: shape(d.education, r["education"]), experience: shape(d.experience, r["experience"]),
    skills: arr(r["skills"]).map((x) => ({ id: str(x["id"], 20) || uid(), name: str(x["name"], 80), level: x["level"] === "preferred" ? "preferred" : "required", enabled: x["enabled"] !== false })),
    languages: arr(r["languages"]).map((x) => ({ id: str(x["id"], 20) || uid(), language: str(x["language"], 60), proficiency: str(x["proficiency"], 40), note: str(x["note"], 200) })),
    equipment: shape(d.equipment, r["equipment"]), eligibility: shape(d.eligibility, r["eligibility"]), who: shape(d.who, r["who"]),
    offer: { ...shape({ heading: d.offer.heading, intro: "" }, r["offer"]), items: items(obj(r["offer"])["items"]) },
    growth: { text: str(obj(r["growth"])["text"], 2000), steps: items(obj(r["growth"])["steps"]) },
    probation: shape(d.probation, r["probation"]), training: shape(d.training, r["training"]), joining: shape(d.joining, r["joining"]),
    highlights: shape(d.highlights, r["highlights"]), day: steps(r["day"]), process: steps(r["process"]), faqs: steps(r["faqs"]), show_team: bool(r["show_team"]),
    application: (() => { const a = shape(d.application as unknown as R, r["application"]) as unknown as JobDetails["application"]; a.after_deadline = a.after_deadline === "auto_close" ? "auto_close" : "show_closed"; a.cta_label ||= "Apply Now"; a.method ||= "form"; return a; })(),
    form: FORM_FIELDS.map(([key]) => {
      const s = savedForm.find((x) => x["key"] === key);
      const def = d.form.find((x) => x.key === key)!;
      return s ? { key, enabled: bool(s["enabled"]), required: bool(s["enabled"]) && bool(s["required"]) } : def;
    }),
    questions: arr(r["questions"]).map((x) => {
      const t = QUESTION_TYPES.find(([k]) => k === x["type"])?.[0] ?? "short";
      return { id: str(x["id"], 20) || uid(), label: str(x["label"], 300), help: str(x["help"], 300), type: t, options: (Array.isArray(x["options"]) ? x["options"] : []).filter((o): o is string => typeof o === "string" && !!o.trim()).slice(0, 30), required: bool(x["required"]), enabled: x["enabled"] !== false, eligibility: bool(x["eligibility"]), eligible_answer: str(x["eligible_answer"], 200) };
    }).filter((q) => q.label.trim()),
  };
}
export const parseSeo = (raw: unknown): JobSeo => shape(emptySeo(), raw);

const num = (s: string) => { const n = Number(String(s).replace(/[, ]/g, "")); return Number.isFinite(n) && s.trim() ? n.toLocaleString("en-US") : s.trim(); };
const PERIOD_SHORT: Record<string, string> = { hour: "hour", day: "day", week: "week", month: "month", year: "year", project: "project" };

/** Public salary line following the display rules (override text wins). */
export function formatSalary(d: Pick<JobDetails, "comp" | "commission">): string {
  const c = d.comp;
  if (c.text.trim()) return c.text.trim();
  const cur = c.currency.trim() || "BDT";
  const per = c.period && PERIOD_SHORT[c.period] ? ` / ${PERIOD_SHORT[c.period]}` : "";
  const fixed = c.amount.trim() ? `${cur} ${num(c.amount)}${per}` : "";
  const range = c.min.trim() && c.max.trim() ? `${cur} ${num(c.min)} to ${num(c.max)}${per}` : c.min.trim() ? `From ${cur} ${num(c.min)}${per}` : "";
  const comm = d.commission.available ? (d.commission.percent.trim() ? `${d.commission.percent.trim().replace(/%?$/, "%")} commission` : d.commission.range.trim() ? `${d.commission.range.trim()} commission` : "performance commission") : "performance commission";
  switch (c.type) {
    case "fixed": return fixed || "Not disclosed";
    case "range": return range || fixed || "Not disclosed";
    case "negotiable": return "Negotiable";
    case "commission_only": return `Commission only (${comm})`;
    case "salary_commission": return `${range || fixed || "Salary"} + ${comm}`;
    case "stipend": return fixed || range ? `Stipend: ${fixed || range}` : "Stipend";
    case "project": return fixed || range ? `${fixed || range} (project based)` : "Project based";
    default: return "Not disclosed";
  }
}

export function formatExperience(e: JobDetails["experience"]): string {
  if (e.text.trim() && (e.kind === "custom" || !e.kind)) return e.text.trim();
  const span = e.min.trim() ? `${e.min.trim()}${e.max.trim() ? `–${e.max.trim()}` : "+"} ${e.unit === "months" ? "months" : "years"}` : "";
  switch (e.kind) {
    case "none": return "No experience required";
    case "freshers": return "Freshers welcome";
    case "minimum": return span ? `Minimum ${span}` : "Experience required";
    case "preferred": return span ? `${span} preferred` : "Experience preferred";
    default: return "";
  }
}
export function formatHours(s: JobDetails["schedule"]): string {
  const t = s.start && s.end ? `${s.start} – ${s.end}` : "";
  return [s.days, t].filter(Boolean).join(", ") || s.shift || "";
}
export function formatDeadline(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }) : "";
}

export type PublicQuestion = Omit<Question, "eligible_answer" | "eligibility" | "enabled">;
export type PublicJob = {
  slug: string; title: string; department: string | null; type: string | null; location: string | null; workMode: string | null;
  summary: string | null; featured: boolean; urgent: boolean; vacancies: number | null; jobCode: string | null;
  openAt: string | null; deadlineAt: string | null; publishedAt: string | null; blocks: Block[];
  details: Omit<JobDetails, "questions" | "application"> & { application: Omit<JobDetails["application"], "auto_reject"> };
  questions: PublicQuestion[]; salary: string; experience: string; hours: string; seo: JobSeo;
  /** "open" | "not_yet" | "closed" — computed when the job was read. */
  window: "open" | "not_yet" | "closed";
};
export type JobRowLike = {
  slug: string; title: string; department: string | null; employment_type: string | null; location: string | null; work_mode: string | null;
  summary: string | null; featured: boolean; urgent?: boolean | null; vacancies?: number | null; job_code?: string | null; open_at?: string | null; deadline_at?: string | null;
  published_at?: string | null; description_json?: unknown; requirements_json?: unknown; details?: unknown; seo?: unknown; status?: string;
};

export function applicationWindow(row: Pick<JobRowLike, "open_at" | "deadline_at" | "status">, d: JobDetails, now = Date.now()): PublicJob["window"] {
  if (row.status && row.status !== "published") return "closed";
  if (row.open_at && new Date(row.open_at).getTime() > now) return "not_yet";
  if (!d.application.no_deadline && row.deadline_at && new Date(row.deadline_at).getTime() < now) return "closed";
  return "open";
}

/** Builds the public job shape (used by the public page and the Control Centre preview). */
export function toPublicJob(row: JobRowLike): PublicJob {
  const d = parseDetails(row.details);
  // Legacy requirements_json lines become requirement items when the new list is empty.
  if (!d.requirements.length && Array.isArray(row.requirements_json)) {
    d.requirements = row.requirements_json.filter((x): x is string => typeof x === "string" && !!x.trim()).map((text) => ({ id: uid(), text, enabled: true }));
  }
  const on = <T extends { enabled: boolean }>(xs: T[]) => xs.filter((x) => x.enabled);
  const { questions, application, ...rest } = d;
  const { auto_reject: _ar, ...app } = application;
  return {
    slug: row.slug, title: row.title, department: row.department, type: row.employment_type, location: row.location, workMode: row.work_mode,
    summary: row.summary, featured: row.featured, urgent: !!row.urgent, vacancies: row.vacancies ?? null, jobCode: row.job_code ?? null,
    openAt: row.open_at ?? null, deadlineAt: application.no_deadline ? null : row.deadline_at ?? null, publishedAt: row.published_at ?? null,
    blocks: parseBlocks(row.description_json),
    details: {
      ...rest, application: app,
      benefits: on(d.benefits).filter((b) => b.title.trim()), responsibilities: on(d.responsibilities).filter((x) => x.text.trim()),
      requirements: on(d.requirements).filter((x) => x.text.trim()), preferred: on(d.preferred).filter((x) => x.text.trim()),
      skills: on(d.skills).filter((x) => x.name.trim()), languages: d.languages.filter((x) => x.language.trim()),
      day: on(d.day).filter((x) => x.title.trim()), process: on(d.process).filter((x) => x.title.trim()), faqs: on(d.faqs).filter((x) => x.title.trim() && x.text.trim()),
      offer: { ...d.offer, items: on(d.offer.items).filter((x) => x.text.trim()) }, growth: { ...d.growth, steps: on(d.growth.steps).filter((x) => x.text.trim()) },
    },
    questions: on(questions).map(({ eligible_answer: _e, eligibility: _g, enabled: _n, ...q }) => q),
    salary: formatSalary(d), experience: formatExperience(d.experience), hours: formatHours(d.schedule), seo: parseSeo(row.seo),
    window: applicationWindow(row, d),
  };
}
