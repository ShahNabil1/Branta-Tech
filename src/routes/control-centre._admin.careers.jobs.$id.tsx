import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, TextArea, SelectInput, CheckboxInput, SaveBar, LoadingRow, ErrorNote, AdminButton, StatusBadge,
  SLUG_RE, friendlyError, nullIfEmpty, useAutoSlug, useFormState, useUnsavedWarning,
} from "@/components/admin/cms";
import { BlocksEditor, fromDrafts, toDrafts, type BlockDraft } from "@/components/admin/BlocksEditor";
import { ItemList, RepeatList, EnabledToggle, sectionFields } from "@/components/admin/JobEditorParts";
import { JobBadges, JobBody, JobFacts } from "@/components/careers/JobDetail";
import { parseBlocks } from "@/lib/rich-text";
import {
  APPLY_METHODS, DEPARTMENTS, EDUCATION_LEVELS, EMPLOYMENT_TYPES, EXPERIENCE_KINDS, FORM_FIELDS, FORM_LABEL, PERIODS, PROFICIENCY, QUESTION_TYPES,
  SALARY_TYPES, SHIFTS, SUGGESTED_BENEFITS, WHO_OPTIONS, WORK_MODES, emptyDetails, emptySeo, formatSalary, parseDetails, parseSeo, toPublicJob, uid,
  type JobDetails, type JobSeo, type QuestionType,
} from "@/lib/job-details";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-centre/_admin/careers/jobs/$id")({
  head: () => adminHead("Edit role"),
  component: JobEditor,
});

const JOB_STATUS = [{ value: "draft", label: "Draft" }, { value: "published", label: "Published (open)" }, { value: "closed", label: "Closed" }, { value: "archived", label: "Archived" }];
const TABS = ["Basic info", "Job description", "Responsibilities", "Requirements", "Skills & experience", "Compensation", "Benefits", "Work schedule", "Eligibility", "Application form", "SEO", "Publishing"] as const;
type Tab = (typeof TABS)[number];

type Form = {
  title: string; department: string; employment_type: string; location: string; work_mode: string; summary: string;
  status: string; featured: boolean; urgent: boolean; sort_order: number; job_code: string; vacancies: string; open_at: string; deadline_at: string;
  blocks: BlockDraft[]; details: JobDetails; seo: JobSeo;
};
const EMPTY: Form = { title: "", department: "", employment_type: "", location: "", work_mode: "", summary: "", status: "draft", featured: false, urgent: false, sort_order: 0, job_code: "", vacancies: "", open_at: "", deadline_at: "", blocks: [], details: emptyDetails(), seo: emptySeo() };

/** ISO → value for <input type="datetime-local"> in the browser's timezone, and back. */
const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function JobEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const f = useFormState<Form>(EMPTY);
  const slug = useAutoSlug("", isNew);
  const [loadedSlug, setLoadedSlug] = useState("");
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Basic info");
  const [preview, setPreview] = useState(false);
  useUnsavedWarning(f.dirty || slug.slug !== loadedSlug);
  const q = useQuery({ queryKey: ["cms", "job", id], enabled: !isNew, queryFn: () => must(supabase.from("jobs").select("*").eq("id", id).single()) });

  useEffect(() => {
    const r = q.data;
    if (!r) return;
    const pj = toPublicJob(r); // migrates legacy requirements_json into the new list
    const details = parseDetails(r.details);
    if (!details.requirements.length) details.requirements = pj.details.requirements;
    f.markSaved({
      title: r.title, department: r.department ?? "", employment_type: r.employment_type ?? "", location: r.location ?? "", work_mode: r.work_mode ?? "",
      summary: r.summary ?? "", status: r.status, featured: r.featured, urgent: r.urgent, sort_order: r.sort_order, job_code: r.job_code ?? "",
      vacancies: r.vacancies ? String(r.vacancies) : "", open_at: toLocal(r.open_at), deadline_at: toLocal(r.deadline_at),
      blocks: toDrafts(parseBlocks(r.description_json)), details, seo: parseSeo(r.seo),
    });
    slug.reset(r.slug); setLoadedSlug(r.slug); setPublishedAt(r.published_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const v = f.values;
  const d = v.details;
  const setD = <K extends keyof JobDetails>(k: K, val: JobDetails[K]) => f.set("details", { ...d, [k]: val });

  async function save(statusOverride?: string, msg = "Role saved") {
    if (!v.title.trim()) return f.fail("Title is required");
    if (!SLUG_RE.test(slug.slug)) return f.fail("Slug: use lowercase letters, numbers and dashes");
    const vac = v.vacancies.trim() ? Number(v.vacancies) : null;
    if (vac !== null && (!Number.isInteger(vac) || vac < 1 || vac > 999)) return f.fail("Vacancies must be a whole number from 1 to 999");
    if (!d.application.no_deadline && !v.deadline_at) return f.fail("Set an application deadline or tick “No deadline”");
    if (d.application.method === "link" && !/^https:\/\//.test(d.application.url)) return f.fail("External apply link must start with https://");
    if (d.application.method === "email" && !/^\S+@\S+\.\S+$/.test(d.application.email)) return f.fail("Enter a valid application email");
    if (v.seo.og_image && !/^https:\/\//.test(v.seo.og_image)) return f.fail("Open Graph image must be an https:// link");
    const status = statusOverride ?? v.status;
    f.begin();
    const pub = status === "published" && !publishedAt ? new Date().toISOString() : publishedAt;
    const payload = {
      title: v.title.trim(), slug: slug.slug, department: nullIfEmpty(v.department), employment_type: nullIfEmpty(v.employment_type), location: nullIfEmpty(v.location),
      work_mode: nullIfEmpty(v.work_mode), summary: nullIfEmpty(v.summary), status, featured: v.featured, urgent: v.urgent, sort_order: Number(v.sort_order) || 0,
      job_code: nullIfEmpty(v.job_code), vacancies: vac, open_at: fromLocal(v.open_at), deadline_at: d.application.no_deadline ? null : fromLocal(v.deadline_at),
      description_json: fromDrafts(v.blocks), details: d as never, seo: v.seo as never, published_at: pub,
      requirements_json: d.requirements.filter((x) => x.enabled && x.text.trim()).map((x) => x.text.trim()),
    };
    const res = isNew ? await supabase.from("jobs").insert(payload).select("id").single() : await supabase.from("jobs").update(payload).eq("id", id).select("id").single();
    if (res.error) return f.fail(res.error.code === "23505" ? "Another role already uses this slug" : friendlyError(res.error));
    qc.invalidateQueries({ queryKey: ["cms"] });
    const nextV = { ...v, status };
    f.markSaved(nextV); setLoadedSlug(slug.slug); setPublishedAt(pub);
    toast.success(msg);
    if (isNew) navigate({ to: "/control-centre/careers/jobs/$id", params: { id: res.data.id }, replace: true });
  }

  const previewJob = useMemo(() => toPublicJob({
    slug: slug.slug || "preview", title: v.title || "Untitled role", department: nullIfEmpty(v.department), employment_type: nullIfEmpty(v.employment_type),
    location: nullIfEmpty(v.location), work_mode: nullIfEmpty(v.work_mode), summary: nullIfEmpty(v.summary), featured: v.featured, urgent: v.urgent,
    vacancies: v.vacancies ? Number(v.vacancies) : null, job_code: nullIfEmpty(v.job_code), open_at: fromLocal(v.open_at), deadline_at: fromLocal(v.deadline_at),
    description_json: fromDrafts(v.blocks), details: d, seo: v.seo, status: "published",
  }), [v, d, slug.slug]);

  if (!isNew && q.isLoading) return <LoadingRow />;
  if (q.error) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  const dirty = f.dirty || slug.slug !== loadedSlug;
  const F = <S extends Record<string, unknown>>(k: keyof JobDetails) => sectionFields(d[k] as unknown as S, (val) => setD(k, val as never));

  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow="Careers" title={isNew ? "New role" : v.title || "Edit role"} actions={<>
        <Link to="/control-centre/careers/jobs"><AdminButton>Back</AdminButton></Link>
        <AdminButton onClick={() => setPreview((p) => !p)}>{preview ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}{preview ? "Close preview" : "Preview job"}</AdminButton>
        {!isNew && <Link to="/control-centre/careers/applications" search={{ job: id }}><AdminButton>Applications</AdminButton></Link>}
      </>} />

      {preview ? (
        <div className="rounded-md border border-border bg-background p-6 md:p-10">
          <p className="text-caption mb-6 text-muted-foreground">Preview of the public page with unsaved changes. Nothing is published until you save.</p>
          <div className="flex flex-wrap gap-2"><JobBadges j={previewJob} /></div>
          <h2 className="text-display mt-4 break-words">{previewJob.title}</h2>
          {previewJob.summary && <p className="text-body-lg mt-4 max-w-2xl text-muted-foreground">{previewJob.summary}</p>}
          <div className="my-10"><JobFacts j={previewJob} /></div>
          <JobBody j={previewJob} />
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Job editor sections" className="mb-6 flex flex-wrap gap-1 border-b border-border pb-2">
            {TABS.map((t) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
                className={cn("text-caption rounded-sm px-3 py-1.5 font-medium transition-colors", tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{t}</button>
            ))}
          </div>
          <div className="grid gap-6">
            {tab === "Basic info" && (
              <Panel title="Basic information">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput className="sm:col-span-2" label="Job title" value={v.title} onChange={(e) => { f.set("title", e.target.value); slug.syncFrom(e.target.value); }} />
                  <TextInput className="sm:col-span-2" label="Slug" value={slug.slug} hint={`/careers/${slug.slug || "…"}${publishedAt && slug.slug !== loadedSlug ? " — the old address will redirect here" : ""}`} onChange={(e) => slug.setSlug(e.target.value)} />
                  <Suggest label="Department" value={v.department} options={DEPARTMENTS} onChange={(x) => f.set("department", x)} />
                  <TextInput label="Job category" value={d.category} onChange={(e) => setD("category", e.target.value)} />
                  <Suggest label="Employment type" value={v.employment_type} options={EMPLOYMENT_TYPES} onChange={(x) => f.set("employment_type", x)} hint='"Internship" lists it under internships' />
                  <Suggest label="Work mode" value={v.work_mode} options={WORK_MODES} onChange={(x) => f.set("work_mode", x)} />
                  <TextInput label="Location" placeholder="e.g. Thanthonia, Bogura" value={v.location} onChange={(e) => f.set("location", e.target.value)} />
                  <TextInput label="Office address" value={d.office_address} onChange={(e) => setD("office_address", e.target.value)} />
                  <TextInput label="Number of vacancies" type="number" min={1} value={v.vacancies} onChange={(e) => f.set("vacancies", e.target.value)} />
                  <TextInput label="Job code / reference ID" hint="Optional" value={v.job_code} onChange={(e) => f.set("job_code", e.target.value)} />
                  <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:gap-8">
                    <CheckboxInput label="Featured job" checked={v.featured} onChange={(c) => f.set("featured", c)} />
                    <CheckboxInput label="Urgent hiring" checked={v.urgent} onChange={(c) => f.set("urgent", c)} />
                  </div>
                </div>
              </Panel>
            )}
            {tab === "Job description" && (<>
              <Panel title="Summary"><TextArea label="Short summary" hint="Shown on the careers list and at the top of the job page." value={v.summary} onChange={(e) => f.set("summary", e.target.value)} /></Panel>
              <Panel title="About the role"><BlocksEditor value={v.blocks} onChange={(b) => f.set("blocks", b)} /></Panel>
              <Panel title="Additional information">{F("additional" as never) && <TextArea label="Shown at the end of the page" value={d.additional} onChange={(e) => setD("additional", e.target.value)} />}</Panel>
            </>)}
            {tab === "Responsibilities" && <Panel title="Responsibilities"><ItemList rows={d.responsibilities} onChange={(r) => setD("responsibilities", r)} addLabel="Add responsibility" placeholder="e.g. Generate new leads" /></Panel>}
            {tab === "Requirements" && (<>
              <Panel title="Requirements"><ItemList rows={d.requirements} onChange={(r) => setD("requirements", r)} addLabel="Add requirement" placeholder="e.g. Strong communication skills" /></Panel>
              <Panel title="Preferred qualifications"><ItemList rows={d.preferred} onChange={(r) => setD("preferred", r)} addLabel="Add qualification" /></Panel>
              <Panel title="Education"><div className="grid gap-4 sm:grid-cols-2">{(() => { const e = F("education"); return <>{e.select("level", "Minimum education level", EDUCATION_LEVELS)}{e.text("field", "Preferred field of study")}{e.area("notes", "Education notes", undefined, "sm:col-span-2")}</>; })()}</div></Panel>
            </>)}
            {tab === "Skills & experience" && (<>
              <Panel title="Experience"><div className="grid gap-4 sm:grid-cols-2">{(() => { const e = F("experience"); return <>{e.select("kind", "Experience requirement", EXPERIENCE_KINDS)}{e.select("unit", "Unit", [["years", "Years"], ["months", "Months"]])}{e.text("min", "Minimum", { type: "number" })}{e.text("max", "Maximum", { type: "number", hint: "Optional" })}{e.area("text", "Experience description", undefined, "sm:col-span-2")}</>; })()}</div></Panel>
              <Panel title="Required skills">
                <RepeatList rows={d.skills} onChange={(r) => setD("skills", r)} addLabel="Add skill" make={() => ({ id: uid(), name: "", level: "required", enabled: true })}
                  render={(r, set) => (
                    <div className="flex flex-wrap items-center gap-3">
                      <input aria-label="Skill name" value={r.name} placeholder="e.g. Lead generation" onChange={(e) => set({ name: e.target.value })} className="text-small h-9 min-w-0 flex-1 rounded-sm border border-input bg-surface px-3" />
                      <select aria-label="Required or preferred" value={r.level} onChange={(e) => set({ level: e.target.value as "required" | "preferred" })} className="text-small h-9 rounded-sm border border-input bg-surface px-2"><option value="required">Required</option><option value="preferred">Preferred</option></select>
                      <EnabledToggle on={r.enabled} set={(x) => set({ enabled: x })} />
                    </div>
                  )} />
              </Panel>
              <Panel title="Language requirements">
                <RepeatList rows={d.languages} onChange={(r) => setD("languages", r)} addLabel="Add language" make={() => ({ id: uid(), language: "", proficiency: "Professional", note: "" })}
                  render={(r, set) => (
                    <div className="flex flex-wrap items-center gap-3">
                      <input aria-label="Language" value={r.language} placeholder="e.g. Bangla" onChange={(e) => set({ language: e.target.value })} className="text-small h-9 w-40 rounded-sm border border-input bg-surface px-3" />
                      <select aria-label="Proficiency" value={r.proficiency} onChange={(e) => set({ proficiency: e.target.value })} className="text-small h-9 rounded-sm border border-input bg-surface px-2">{PROFICIENCY.map((p) => <option key={p}>{p}</option>)}</select>
                      <input aria-label="Note" value={r.note} placeholder="Note (optional)" onChange={(e) => set({ note: e.target.value })} className="text-small h-9 min-w-0 flex-1 rounded-sm border border-input bg-surface px-3" />
                    </div>
                  )} />
              </Panel>
            </>)}
            {tab === "Compensation" && (<>
              <Panel title="Salary" description={`Public display: ${formatSalary(d)}`}>
                <div className="grid gap-4 sm:grid-cols-3">{(() => { const c = F("comp"); const t = d.comp.type; return <>
                  {c.select("type", "Salary display type", SALARY_TYPES)}{c.text("currency", "Currency", { hint: "BDT, USD or custom" })}{c.select("period", "Salary period", PERIODS)}
                  {(t === "fixed" || t === "stipend" || t === "project" || t === "salary_commission") && c.text("amount", "Amount", { placeholder: "15000" })}
                  {(t === "range" || t === "salary_commission" || t === "stipend" || t === "project") && <>{c.text("min", "Minimum salary")}{c.text("max", "Maximum salary")}</>}
                  {c.area("text", "Salary text override", "Optional — replaces the generated line, e.g. “BDT 15,000 to 20,000 per month depending on experience.”", "sm:col-span-3")}
                </>; })()}</div>
              </Panel>
              <Panel title="Commission & performance incentives">
                <div className="grid gap-4 sm:grid-cols-3">{(() => { const c = F("commission"); return <>
                  <div className="sm:col-span-3 flex flex-col gap-3 sm:flex-row sm:gap-8">{c.check("available", "Commission available")}{c.check("performance_bonus", "Performance bonus")}{c.check("target_bonus", "Target bonus")}</div>
                  {d.commission.available && <>{c.select("type", "Commission type", [["percentage", "Percentage"], ["fixed", "Fixed"], ["tiered", "Tiered"], ["custom", "Custom"]])}{c.text("percent", "Commission percentage", { placeholder: "10%" })}{c.text("range", "Commission range", { placeholder: "10% to 15%" })}</>}
                  {c.area("text", "Custom incentive description", undefined, "sm:col-span-3")}
                </>; })()}</div>
              </Panel>
            </>)}
            {tab === "Benefits" && (
              <Panel title="Benefits & perks" description="Add from suggestions or create your own.">
                <RepeatList rows={d.benefits} onChange={(r) => setD("benefits", r)} addLabel="Add custom benefit" make={() => ({ id: uid(), title: "", description: "", icon: "", enabled: true })}
                  extraActions={<select aria-label="Add a suggested benefit" value="" onChange={(e) => e.target.value && setD("benefits", [...d.benefits, { id: uid(), title: e.target.value, description: "", icon: "", enabled: true }])} className="text-caption h-8 rounded-sm border border-input bg-surface px-2">
                    <option value="">+ Add suggested…</option>{SUGGESTED_BENEFITS.filter((s) => !d.benefits.some((b) => b.title === s)).map((s) => <option key={s}>{s}</option>)}
                  </select>}
                  render={(r, set) => (
                    <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto] sm:items-center">
                      <input aria-label="Benefit title" value={r.title} placeholder="Title" onChange={(e) => set({ title: e.target.value })} className="text-small h-9 rounded-sm border border-input bg-surface px-3" />
                      <input aria-label="Benefit description" value={r.description} placeholder="Description (optional)" onChange={(e) => set({ description: e.target.value })} className="text-small h-9 rounded-sm border border-input bg-surface px-3" />
                      <EnabledToggle on={r.enabled} set={(x) => set({ enabled: x })} />
                    </div>
                  )} />
              </Panel>
            )}
            {tab === "Work schedule" && (<>
              <Panel title="Work schedule"><div className="grid gap-4 sm:grid-cols-3">{(() => { const s = F("schedule"); return <>
                {s.text("days", "Working days", { placeholder: "Saturday to Thursday" })}{s.text("days_off", "Weekly days off", { placeholder: "Friday" })}{s.select("shift", "Shift type", SHIFTS)}
                {s.text("start", "Start time", { placeholder: "2:00 PM" })}{s.text("end", "End time", { placeholder: "6:00 PM" })}<div />
                {s.text("hours_day", "Hours per day")}{s.text("hours_week", "Hours per week")}<div />
                {s.area("text", "Custom schedule description", undefined, "sm:col-span-3")}
              </>; })()}</div></Panel>
              <Panel title="Probation"><div className="grid gap-4 sm:grid-cols-3">{(() => { const s = F("probation"); return <><div className="sm:col-span-3">{s.check("applicable", "Probation applicable")}</div>{d.probation.applicable && <>{s.text("duration", "Duration", { placeholder: "3 months" })}{s.text("salary", "Probation salary", { hint: "Optional" })}{s.area("notes", "Probation notes", undefined, "sm:col-span-3")}</>}</>; })()}</div></Panel>
              <Panel title="Training"><div className="grid gap-4 sm:grid-cols-3">{(() => { const s = F("training"); return <><div className="flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:gap-8">{s.check("provided", "Training provided")}{d.training.provided && s.check("paid", "Paid training")}</div>{d.training.provided && <>{s.text("duration", "Training duration")}{s.area("text", "Training description", undefined, "sm:col-span-3")}</>}</>; })()}</div></Panel>
              <Panel title="Joining details"><div className="grid gap-4 sm:grid-cols-3">{(() => { const s = F("joining"); return <><div className="sm:col-span-3">{s.check("immediate", "Immediate joining")}</div>{s.text("date", "Expected joining date", { type: "date" })}{s.text("text", "Joining date text", { placeholder: "Within 2 weeks of selection" })}{s.text("notice", "Notice period preference", { hint: "Optional" })}</>; })()}</div></Panel>
            </>)}
            {tab === "Eligibility" && (<>
              <Panel title="Equipment / device requirements" description="Shown clearly on the public job page.">
                <div className="grid gap-4 sm:grid-cols-2">{(() => { const s = F("equipment"); return <>{s.check("laptop", "Personal laptop required")}{s.check("phone", "Personal smartphone required")}{s.check("internet", "Stable internet required")}{s.check("headset", "Headset required")}{s.area("text", "Custom device requirement", undefined, "sm:col-span-2")}</>; })()}</div>
              </Panel>
              <Panel title="Who can apply">
                <div className="grid gap-3 sm:grid-cols-3">{WHO_OPTIONS.map((o) => <CheckboxInput key={o} label={o} checked={d.who.options.includes(o)} onChange={(c) => setD("who", { ...d.who, options: c ? [...d.who.options, o] : d.who.options.filter((x) => x !== o) })} />)}</div>
                <div className="mt-4">{F("who").area("text", "Custom text")}</div>
              </Panel>
              <Panel title="Eligibility" description="All optional. Only use criteria that are lawful and genuinely needed.">
                <div className="grid gap-4 sm:grid-cols-3">{(() => { const s = F("eligibility"); return <>{s.text("min_age", "Minimum age", { type: "number" })}{s.text("max_age", "Maximum age", { type: "number" })}<div className="self-end">{s.check("show_age", "Show age requirement publicly")}</div>{s.text("gender", "Gender preference", { hint: "Leave empty unless legally appropriate" })}{s.text("authorization", "Nationality / work authorization", { className: "sm:col-span-2" })}{s.area("notes", "Custom eligibility notes", undefined, "sm:col-span-3")}</>; })()}</div>
              </Panel>
              <Panel title="What we offer">
                <div className="grid gap-4">{(() => { const s = sectionFields(d.offer as unknown as Record<string, unknown>, (x) => setD("offer", x as never)); return <>{s.text("heading", "Heading")}{s.area("intro", "Short introduction")}</>; })()}</div>
                <div className="mt-4"><ItemList rows={d.offer.items} onChange={(r) => setD("offer", { ...d.offer, items: r })} addLabel="Add offer item" placeholder="e.g. Real client communication" /></div>
              </Panel>
              <Panel title="Career growth" description="Optional progression steps.">
                <ItemList rows={d.growth.steps} onChange={(r) => setD("growth", { ...d.growth, steps: r })} addLabel="Add step" placeholder="e.g. Senior Sales Representative" />
                <div className="mt-4"><TextArea label="Growth description" value={d.growth.text} onChange={(e) => setD("growth", { ...d.growth, text: e.target.value })} /></div>
              </Panel>
            </>)}
            {tab === "Application form" && (<>
              <Panel title="Application deadline">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput label="Application open date" type="datetime-local" hint="Optional — before this, the page says “Applications open soon”." value={v.open_at} onChange={(e) => f.set("open_at", e.target.value)} />
                  <TextInput label="Application deadline" type="datetime-local" disabled={d.application.no_deadline} value={v.deadline_at} onChange={(e) => f.set("deadline_at", e.target.value)} />
                  <CheckboxInput label="No deadline" checked={d.application.no_deadline} onChange={(c) => setD("application", { ...d.application, no_deadline: c })} />
                  <SelectInput label="When the deadline passes" value={d.application.after_deadline} onChange={(e) => setD("application", { ...d.application, after_deadline: e.target.value as "show_closed" | "auto_close" })}
                    options={[{ value: "show_closed", label: "Keep visible, show “Applications closed”" }, { value: "auto_close", label: "Close automatically (hide from the list)" }]} />
                </div>
              </Panel>
              <Panel title="Application method">
                <div className="grid gap-4 sm:grid-cols-2">{(() => { const s = F("application"); const m = d.application.method; return <>
                  {s.select("method", "Apply method", APPLY_METHODS)}{s.text("cta_label", "Application button label", { placeholder: "Apply Now" })}
                  {m === "email" && s.text("email", "Application email", { type: "email" })}{m === "link" && s.text("url", "External link", { placeholder: "https://" })}{m === "whatsapp" && s.text("whatsapp", "WhatsApp number", { placeholder: "+8801…" })}
                  {m !== "form" && s.area("custom_text", "Instructions for applicants", undefined, "sm:col-span-2")}
                </>; })()}</div>
              </Panel>
              {d.application.method === "form" && (<>
                <Panel title="Form fields" description="Full name and email are always required.">
                  <ul className="divide-y divide-border">
                    {FORM_FIELDS.map(([key]) => { const c = d.form.find((x) => x.key === key)!; const put = (p: Partial<typeof c>) => setD("form", d.form.map((x) => (x.key === key ? { ...x, ...p, required: (p.enabled ?? x.enabled) && (p.required ?? x.required) } : x))); return (
                      <li key={key} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2">
                        <span className="text-small min-w-48 flex-1 font-medium">{FORM_LABEL[key]}</span>
                        <CheckboxInput label="Enabled" checked={c.enabled} onChange={(x) => put({ enabled: x })} />
                        <CheckboxInput label="Required" checked={c.required} onChange={(x) => put({ required: x, enabled: x || c.enabled })} />
                      </li>
                    ); })}
                  </ul>
                </Panel>
                <Panel title="Custom questions" description="Mark Yes/No or choice questions as eligibility questions to flag applicants in the Control Centre.">
                  <RepeatList rows={d.questions} onChange={(r) => setD("questions", r)} addLabel="Add question" make={() => ({ id: uid(), label: "", help: "", type: "short", options: [], required: false, enabled: true, eligibility: false, eligible_answer: "" })}
                    render={(r, set) => (
                      <div className="grid gap-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                          <input aria-label="Question" value={r.label} placeholder="e.g. Do you have a personal laptop?" onChange={(e) => set({ label: e.target.value })} className="text-small h-9 rounded-sm border border-input bg-surface px-3" />
                          <select aria-label="Question type" value={r.type} onChange={(e) => set({ type: e.target.value as QuestionType })} className="text-small h-9 rounded-sm border border-input bg-surface px-2">{QUESTION_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                        </div>
                        {["single", "multi", "dropdown"].includes(r.type) && <input aria-label="Options" value={r.options.join(", ")} placeholder="Options, comma separated" onChange={(e) => set({ options: e.target.value.split(",").map((x) => x.trimStart()) })} className="text-small h-9 rounded-sm border border-input bg-surface px-3" />}
                        <input aria-label="Help text" value={r.help} placeholder="Help text (optional)" onChange={(e) => set({ help: e.target.value })} className="text-small h-9 rounded-sm border border-input bg-surface px-3" />
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                          <CheckboxInput label="Required" checked={r.required} onChange={(x) => set({ required: x })} />
                          <EnabledToggle on={r.enabled} set={(x) => set({ enabled: x })} />
                          {["yesno", "single", "multi", "dropdown"].includes(r.type) && <CheckboxInput label="Eligibility question" checked={r.eligibility} onChange={(x) => set({ eligibility: x })} />}
                          {r.eligibility && <input aria-label="Required answer" value={r.eligible_answer} placeholder={r.type === "yesno" ? "Yes" : "Required answer"} onChange={(e) => set({ eligible_answer: e.target.value })} className="text-small h-8 w-40 rounded-sm border border-input bg-surface px-2" />}
                        </div>
                      </div>
                    )} />
                  <div className="mt-4"><CheckboxInput label="Automatically reject applicants who fail an eligibility question" hint="Off by default — failing applicants are only flagged." checked={d.application.auto_reject} onChange={(c) => setD("application", { ...d.application, auto_reject: c })} /></div>
                </Panel>
              </>)}
            </>)}
            {tab === "SEO" && (
              <Panel title="SEO" description="Leave empty to use the job title and summary.">
                <div className="grid gap-4 sm:grid-cols-2">{(() => { const s = sectionFields(v.seo as unknown as Record<string, unknown>, (x) => f.set("seo", x as never)); return <>
                  {s.text("title", "SEO title")}{s.text("og_title", "Open Graph title")}{s.area("description", "SEO description")}{s.area("og_description", "Open Graph description")}
                  {s.text("og_image", "Open Graph image URL", { placeholder: "https://" })}{s.text("canonical", "Canonical URL", { hint: "Only if this job lives elsewhere too" })}
                </>; })()}</div>
              </Panel>
            )}
            {tab === "Publishing" && (
              <Panel title="Publishing" actions={<StatusBadge status={v.status} />}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <SelectInput label="Status" value={v.status} options={JOB_STATUS} onChange={(e) => f.set("status", e.target.value)} />
                  <TextInput label="Order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", Number(e.target.value))} />
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {v.status !== "published" && <AdminButton variant="primary" onClick={() => save("published", "Role published")}>{v.status === "closed" ? "Reopen & publish" : "Publish"}</AdminButton>}
                  {v.status === "published" && <AdminButton onClick={() => save("draft", "Role unpublished")}>Unpublish</AdminButton>}
                  {v.status === "published" && <AdminButton onClick={() => save("closed", "Applications closed")}>Close applications</AdminButton>}
                  {v.status !== "archived" && <AdminButton variant="ghost" onClick={() => save("archived", "Role archived")}>Archive</AdminButton>}
                  {v.status === "draft" && <AdminButton variant="ghost" onClick={() => save("draft", "Draft saved")}>Save draft</AdminButton>}
                </div>
              </Panel>
            )}
          </div>
        </>
      )}
      <SaveBar state={f.state} dirty={dirty} error={f.error} onSave={() => save(undefined, v.status === "published" ? "Published job updated" : "Role saved")} label={v.status === "published" ? "Update published job" : "Save"} />
    </div>
  );
}

/** Text input with suggestions (free text allowed). */
function Suggest({ label, value, options, onChange, hint }: { label: string; value: string; options: string[]; onChange: (v: string) => void; hint?: string }): ReactNode {
  const listId = `dl-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <>
      <TextInput label={label} hint={hint} value={value} list={listId} onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </>
  );
}
