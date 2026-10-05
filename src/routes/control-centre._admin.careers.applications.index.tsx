import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, DataTable, Td, LoadingRow, ErrorNote, EmptyState, AdminButton, SelectInput, formatDate, friendlyError } from "@/components/admin/cms";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/ats";

export const Route = createFileRoute("/control-centre/_admin/careers/applications/")({
  validateSearch: z.object({ job: z.string().optional(), status: z.string().optional() }),
  head: () => adminHead("Applications"),
  component: ApplicationsList,
});

function ApplicationsList() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const jobs = useQuery({ queryKey: ["cms", "jobs-min"], queryFn: () => must(supabase.from("jobs").select("id,title").order("title")) });
  const q = useQuery({
    queryKey: ["cms", "applications"],
    queryFn: () => must(supabase.from("job_applications").select("id,full_name,email,phone,status,submitted_at,job_id,extra,eligibility_passed,resume_url,jobs(title)").order("submitted_at", { ascending: false }).limit(500)),
  });
  const rows = (q.data ?? []).filter((a) => (!search.job || a.job_id === search.job) && (!search.status || a.status === search.status));
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Careers" title="Applications" description="Visible only to admins and HR." actions={<Link to="/control-centre/careers/jobs"><AdminButton>Jobs</AdminButton></Link>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 md:max-w-xl">
        <SelectInput label="Role" value={search.job ?? ""} onChange={(e) => navigate({ search: (s) => ({ ...s, job: e.target.value || undefined }) })} options={[{ value: "", label: "All roles" }, ...(jobs.data ?? []).map((j) => ({ value: j.id, label: j.title }))]} />
        <SelectInput label="Status" value={search.status ?? ""} onChange={(e) => navigate({ search: (s) => ({ ...s, status: e.target.value || undefined }) })} options={[{ value: "", label: "All statuses" }, ...APPLICATION_STATUS_OPTIONS]} />
      </div>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && rows.length === 0 && <EmptyState>{q.data.length === 0 ? "No applications yet." : "No applications match these filters."}</EmptyState>}
      {rows.length > 0 && (
        <DataTable head={["Applicant", "Contact", "Role", "Expected salary", "Eligibility", "CV", "Status", "Submitted", ""]}>
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-muted/30">
              <Td className="font-medium"><Link to="/control-centre/careers/applications/$id" params={{ id: a.id }} className="hover:text-accent">{a.full_name}</Link></Td>
              <Td className="text-muted-foreground">{a.email}<br />{a.phone}</Td>
              <Td>{a.jobs?.title ?? "—"}</Td>
              <Td>{String((a.extra as Record<string, unknown> | null)?.["expected_salary"] ?? "—")}</Td>
              <Td>{a.eligibility_passed === null ? "—" : a.eligibility_passed ? "Meets" : <span className="text-destructive">Does not meet</span>}</Td>
              <Td>{a.resume_url ? "Yes" : "—"}</Td>
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
