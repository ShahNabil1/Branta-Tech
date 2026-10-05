import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, DataTable, Td, LoadingRow, ErrorNote, EmptyState, AdminButton, SelectInput, TextInput, formatDate, friendlyError } from "@/components/admin/cms";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/ats";
import { formatMonths, highestEducation, readRecords, topSkills, totalExperienceMonths, extraText } from "@/lib/application-records";
import { exportApplications, type ExportApp } from "@/lib/application-export";

export const Route = createFileRoute("/control-centre/_admin/careers/applications/")({
  validateSearch: z.object({
    job: z.string().optional(), status: z.string().optional(), q: z.string().optional(), edu: z.string().optional(),
    exp: z.string().optional(), skill: z.string().optional(), loc: z.string().optional(), from: z.string().optional(), to: z.string().optional(),
  }),
  head: () => adminHead("Applications"),
  component: ApplicationsList,
});

const EXP_OPTIONS = [{ value: "", label: "Any experience" }, { value: "none", label: "No experience" }, { value: "lt1", label: "Under 1 year" }, { value: "1to3", label: "1–3 years" }, { value: "3plus", label: "3+ years" }];
const SELECT = "id,full_name,email,phone,location,status,submitted_at,job_id,portfolio_url,linkedin_url,cover_note,resume_url,eligibility_passed,extra,answers,jobs(title,department)";

function ApplicationsList() {
  const s = Route.useSearch();
  const navigate = Route.useNavigate();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const put = (k: keyof typeof s, v: string) => navigate({ search: (p) => ({ ...p, [k]: v || undefined }), replace: true });
  const jobs = useQuery({ queryKey: ["cms", "jobs-min"], queryFn: () => must(supabase.from("jobs").select("id,title").order("title")) });
  const q = useQuery({ queryKey: ["cms", "applications"], queryFn: () => must(supabase.from("job_applications").select(SELECT).order("submitted_at", { ascending: false }).limit(1000)) });

  const enriched = useMemo(() => (q.data ?? []).map((a) => {
    const r = readRecords(a.extra);
    const months = totalExperienceMonths(r);
    return { a: a as unknown as ExportApp & { job_id: string }, r, months, edu: highestEducation(r) || r.legacy_education, skills: topSkills(r, 3), city: extraText(a.extra, "city") };
  }), [q.data]);
  const eduLevels = useMemo(() => [...new Set(enriched.flatMap((x) => x.r.education.map((e) => e.level)).filter(Boolean))].sort(), [enriched]);

  const rows = enriched.filter(({ a, r, months, city }) => {
    const text = (s.q ?? "").trim().toLowerCase();
    if (s.job && a.job_id !== s.job) return false;
    if (s.status && a.status !== s.status) return false;
    if (text && ![a.full_name, a.email, a.phone].some((v) => v?.toLowerCase().includes(text))) return false;
    if (s.edu && !r.education.some((e) => e.level === s.edu)) return false;
    if (s.skill && !r.skills.some((k) => k.name.toLowerCase().includes(s.skill!.toLowerCase()))) return false;
    if (s.loc && ![a.location, city, extraText(a.extra, "country")].some((v) => v?.toLowerCase().includes(s.loc!.toLowerCase()))) return false;
    if (s.from && a.submitted_at < s.from) return false;
    if (s.to && a.submitted_at.slice(0, 10) > s.to) return false;
    if (s.exp) {
      if (months === null) return false;
      if (s.exp === "none" && months !== 0) return false;
      if (s.exp === "lt1" && !(months > 0 && months < 12)) return false;
      if (s.exp === "1to3" && !(months >= 12 && months <= 36)) return false;
      if (s.exp === "3plus" && months < 36) return false;
    }
    return true;
  });
  const visibleIds = rows.map((x) => x.a.id);
  const allPicked = visibleIds.length > 0 && visibleIds.every((id) => picked.has(id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function doExport(list: ExportApp[], name: string) {
    if (!list.length) return void toast.error("Nothing to export");
    setBusy(true);
    try { await exportApplications(list, `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`); toast.success(`Exported ${list.length} applicant${list.length > 1 ? "s" : ""}`); }
    catch { toast.error("Export failed. Please try again."); }
    finally { setBusy(false); }
  }
  const selectedApps = enriched.filter((x) => picked.has(x.a.id)).map((x) => x.a);

  return (
    <div className="max-w-7xl">
      <PageHeader eyebrow="Careers" title="Applications" description="Submitted applications only (unfinished drafts stay private to the applicant). Visible to admins and HR."
        actions={<Link to="/control-centre/careers/jobs"><AdminButton>Jobs</AdminButton></Link>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput label="Search" placeholder="Name, email or phone" value={s.q ?? ""} onChange={(e) => put("q", e.target.value)} />
        <SelectInput label="Job" value={s.job ?? ""} onChange={(e) => put("job", e.target.value)} options={[{ value: "", label: "All jobs" }, ...(jobs.data ?? []).map((j) => ({ value: j.id, label: j.title }))]} />
        <SelectInput label="Status" value={s.status ?? ""} onChange={(e) => put("status", e.target.value)} options={[{ value: "", label: "All statuses" }, ...APPLICATION_STATUS_OPTIONS]} />
        <SelectInput label="Education level" value={s.edu ?? ""} onChange={(e) => put("edu", e.target.value)} options={[{ value: "", label: "Any level" }, ...eduLevels.map((l) => ({ value: l, label: l }))]} />
        <SelectInput label="Experience" value={s.exp ?? ""} onChange={(e) => put("exp", e.target.value)} options={EXP_OPTIONS} />
        <TextInput label="Skill" placeholder="e.g. Sales" value={s.skill ?? ""} onChange={(e) => put("skill", e.target.value)} />
        <TextInput label="Location" placeholder="City or country" value={s.loc ?? ""} onChange={(e) => put("loc", e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <TextInput label="From" type="date" value={s.from ?? ""} onChange={(e) => put("from", e.target.value)} />
          <TextInput label="To" type="date" value={s.to ?? ""} onChange={(e) => put("to", e.target.value)} />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="text-small mr-2 text-muted-foreground">{rows.length} shown · {picked.size} selected</p>
        <AdminButton size="sm" disabled={busy || !picked.size} onClick={() => doExport(selectedApps, "applicants-selected")}><FileSpreadsheet className="size-4" aria-hidden />Export Selected</AdminButton>
        <AdminButton size="sm" disabled={busy || !rows.length} onClick={() => doExport(rows.map((x) => x.a), "applicants-current-view")}><FileSpreadsheet className="size-4" aria-hidden />Export Current View</AdminButton>
        {picked.size > 0 && <AdminButton size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear selection</AdminButton>}
      </div>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && rows.length === 0 && <EmptyState>{q.data.length === 0 ? "No applications yet." : "No applications match these filters."}</EmptyState>}
      {rows.length > 0 && (
        <DataTable head={["", "Applicant", "Job", "Education", "Experience", "Key skills", "Expected salary", "Status", "Applied", ""]}>
          <tr className="bg-muted/20">
            <Td><input type="checkbox" aria-label="Select all visible" checked={allPicked} onChange={() => setPicked((p) => { const n = new Set(p); visibleIds.forEach((id) => (allPicked ? n.delete(id) : n.add(id))); return n; })} className="size-4" /></Td>
            <Td className="text-caption text-muted-foreground" >Select all visible</Td><Td /><Td /><Td /><Td /><Td /><Td /><Td /><Td />
          </tr>
          {rows.map(({ a, edu, months, skills, r }) => (
            <tr key={a.id} className="hover:bg-muted/30">
              <Td><input type="checkbox" aria-label={`Select ${a.full_name}`} checked={picked.has(a.id)} onChange={() => toggle(a.id)} className="size-4" /></Td>
              <Td className="font-medium"><Link to="/control-centre/careers/applications/$id" params={{ id: a.id }} className="hover:text-accent">{a.full_name}</Link><br /><span className="text-caption font-normal text-muted-foreground">{a.email}<br />{a.phone}</span></Td>
              <Td>{a.jobs?.title ?? "—"}{extraText(a.extra, "current_status") && <><br /><span className="text-caption text-muted-foreground">{extraText(a.extra, "current_status")}</span></>}</Td>
              <Td className="max-w-[200px] text-small">{edu || "—"}</Td>
              <Td className="whitespace-nowrap">{formatMonths(months) || r.legacy_experience.slice(0, 40) || "—"}</Td>
              <Td className="max-w-[180px] text-small">{skills.join(", ") || "—"}</Td>
              <Td>{extraText(a.extra, "expected_salary") || "—"}</Td>
              <Td><span className="text-caption rounded-sm border border-border px-2 py-0.5 capitalize">{a.status}</span></Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(a.submitted_at)}</Td>
              <Td><div className="flex justify-end"><Link to="/control-centre/careers/applications/$id" params={{ id: a.id }}><AdminButton size="sm">Open</AdminButton></Link></div></Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
