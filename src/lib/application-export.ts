/**
 * Control Centre Excel export (browser-only, generated on demand from rows HR can already read under RLS).
 * Never includes internal HR notes. ExcelJS is loaded only when an export is requested.
 */
import { DOC_LABEL, formatMonths, highestEducation, readRecords, topSkills, totalExperienceMonths, yearSpan, extraText } from "./application-records";

export type ExportApp = {
  id: string; full_name: string; email: string; phone: string; location: string | null; status: string; submitted_at: string;
  portfolio_url: string | null; linkedin_url: string | null; cover_note: string; resume_url: string | null; eligibility_passed: boolean | null;
  extra: unknown; answers: unknown; jobs: { title: string; department?: string | null } | null;
};

const d = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function summaryRow(a: ExportApp) {
  const r = readRecords(a.extra);
  const x = (k: string) => extraText(a.extra, k);
  return {
    "Application ID": a.id, "Applicant Name": a.full_name, Email: a.email, Phone: a.phone, "Job Title": a.jobs?.title ?? "", Department: a.jobs?.department ?? "",
    "Application Date": d(a.submitted_at), Status: a.status, Address: a.location ?? "", City: x("city"), Country: x("country"), "Current Status": x("current_status"),
    "Highest Education": highestEducation(r) || r.legacy_education, Experience: formatMonths(totalExperienceMonths(r)) || r.legacy_experience,
    "Current Company": x("current_company"), "Current Position": x("current_position"), "Expected Salary": x("expected_salary"), "Notice Period": x("notice_period"),
    Availability: x("joining_date"), "Top Skills": topSkills(r, 6).join(", "), LinkedIn: a.linkedin_url ?? "", Portfolio: a.portfolio_url ?? "", Website: x("website_url"),
    GitHub: x("github_url"), Behance: x("behance_url"), Eligibility: a.eligibility_passed === null ? "" : a.eligibility_passed ? "Meets" : "Does not meet", "CV attached": a.resume_url ? "Yes" : "No",
  };
}

const answerRows = (a: ExportApp) => Object.values((a.answers && typeof a.answers === "object" ? a.answers : {}) as Record<string, { label: string; value: string | string[] }>)
  .map((q) => ({ "Application ID": a.id, Applicant: a.full_name, Question: q.label, Answer: Array.isArray(q.value) ? q.value.join(", ") : String(q.value).startsWith("file:") ? "(file uploaded)" : String(q.value) }));

async function workbook(apps: ExportApp[], single: boolean) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Branta Control Centre";
  const sheet = (name: string, rows: Record<string, string>[], cols?: string[]) => {
    const ws = wb.addWorksheet(name);
    const keys = cols ?? Object.keys(rows[0] ?? {});
    ws.columns = keys.map((k) => ({ header: k, key: k, width: Math.min(48, Math.max(12, k.length + 2, ...rows.map((r) => Math.min(60, String(r[k] ?? "").length + 2)))) }));
    ws.getRow(1).font = { bold: true, name: "Arial" };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    rows.forEach((r) => ws.addRow(r));
    ws.eachRow((row) => row.eachCell((c) => { c.alignment = { vertical: "top", wrapText: true }; if (!c.font?.bold) c.font = { name: "Arial" }; }));
  };
  const summaries = apps.map(summaryRow);
  if (single) sheet("Applicant Summary", Object.entries(summaries[0] ?? {}).map(([Field, Value]) => ({ Field, Value: String(Value) })), ["Field", "Value"]);
  else sheet("Applicants", summaries, Object.keys(summaryRow(apps[0]!)));
  const edu = apps.flatMap((a) => readRecords(a.extra).education.map((e) => ({ "Application ID": a.id, Applicant: a.full_name, Institution: e.institution, Level: e.level, "Department / Subject": e.field, Major: e.major, Years: yearSpan(e.start_year, e.end_year, e.is_current), "Current Student": e.is_current ? "Yes" : "No", Result: e.result, Description: e.description })));
  const exp = apps.flatMap((a) => readRecords(a.extra).experience.map((e) => ({ "Application ID": a.id, Applicant: a.full_name, Company: e.company, "Job Title": e.title, "Employment Type": e.employment_type, Period: yearSpan(e.start_date, e.end_date, e.is_current), "Currently Working": e.is_current ? "Yes" : "No", Responsibilities: e.responsibilities, Achievements: e.achievements })));
  const skills = apps.flatMap((a) => { const r = readRecords(a.extra); return [...r.skills.map((s) => ({ "Application ID": a.id, Applicant: a.full_name, Type: "Skill", Name: s.name, Level: s.level })), ...r.languages.map((l) => ({ "Application ID": a.id, Applicant: a.full_name, Type: "Language", Name: l.language, Level: l.proficiency }))]; });
  const ans = apps.flatMap(answerRows);
  const docs = apps.flatMap((a) => [
    ...(a.resume_url ? [{ "Application ID": a.id, Applicant: a.full_name, Document: "CV / Resume", "Stored privately": "Yes" }] : []),
    ...Object.keys(DOC_LABEL).filter((k) => k !== "resume" && extraText(a.extra, k)).map((k) => ({ "Application ID": a.id, Applicant: a.full_name, Document: DOC_LABEL[k]!, "Stored privately": "Yes" })),
  ]);
  sheet("Education", edu, ["Application ID", "Applicant", "Institution", "Level", "Department / Subject", "Major", "Years", "Current Student", "Result", "Description"]);
  sheet("Experience", exp, ["Application ID", "Applicant", "Company", "Job Title", "Employment Type", "Period", "Currently Working", "Responsibilities", "Achievements"]);
  sheet("Skills", skills, ["Application ID", "Applicant", "Type", "Name", "Level"]);
  sheet("Application Answers", ans, ["Application ID", "Applicant", "Question", "Answer"]);
  if (single) sheet("Documents", docs, ["Application ID", "Applicant", "Document", "Stored privately"]);
  return wb;
}

/** Builds and downloads an .xlsx; nothing is uploaded or stored. */
export async function exportApplications(apps: ExportApp[], filename: string) {
  if (!apps.length) return;
  const wb = await workbook(apps, apps.length === 1 && filename.startsWith("applicant-"));
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename.replace(/[^\w.-]+/g, "-");
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
