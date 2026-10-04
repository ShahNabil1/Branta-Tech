import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must, saveSettingsGroup } from "@/lib/supabase/cms";
import { PageHeader, Panel, TextInput, TextArea, SaveBar, LoadingRow, ErrorNote, useFormState, useUnsavedWarning, isSafeUrl, friendlyError } from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/settings/site")({
  head: () => adminHead("Site settings"),
  component: SettingsRoute,
});

type FieldDef = { key: string; label: string; kind?: "url" | "email" | "textarea" };
const GROUPS: { group: string; title: string; fields: FieldDef[] }[] = [
  { group: "company", title: "Company", fields: [{ key: "company_name", label: "Company name" }, { key: "short_description", label: "Short description", kind: "textarea" }] },
  { group: "contact", title: "Contact", fields: [{ key: "email", label: "Email", kind: "email" }, { key: "phone", label: "Phone" }, { key: "address", label: "Address", kind: "textarea" }] },
  { group: "social", title: "Social", fields: ["facebook", "instagram", "linkedin", "youtube", "x"].map((k) => ({ key: k, label: k === "x" ? "X" : k[0].toUpperCase() + k.slice(1), kind: "url" as const })) },
  { group: "brand", title: "Brand", fields: [{ key: "logo_url", label: "Logo URL", kind: "url" }, { key: "logo_dark_url", label: "Logo (dark) URL", kind: "url" }, { key: "favicon_url", label: "Favicon URL", kind: "url" }] },
  { group: "footer", title: "Footer", fields: [{ key: "footer_tagline", label: "Footer tagline" }, { key: "copyright_text", label: "Copyright text" }] },
  { group: "default_seo", title: "Default SEO", fields: [{ key: "title", label: "Title" }, { key: "description", label: "Description", kind: "textarea" }, { key: "og_image", label: "OG image URL", kind: "url" }] },
];

type Values = Record<string, Record<string, string>>;

function SettingsRoute() {
  const q = useQuery({
    queryKey: ["cms", "settings", "site"],
    queryFn: () => must(supabase.from("site_settings").select("setting_group,settings").in("setting_group", GROUPS.map((g) => g.group))),
  });
  if (q.isLoading) return <LoadingRow />;
  if (q.error) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  const initial: Values = {};
  for (const g of GROUPS) {
    const row = q.data?.find((r) => r.setting_group === g.group)?.settings as Record<string, unknown> | undefined;
    initial[g.group] = Object.fromEntries(g.fields.map((f) => [f.key, typeof row?.[f.key] === "string" ? (row[f.key] as string) : ""]));
  }
  return <SettingsForm initial={initial} />;
}

function fieldError(f: FieldDef, v: string) {
  if (!v) return null;
  if (f.kind === "url" && !isSafeUrl(v, { allowInternal: false })) return "Use a full https:// URL.";
  if (f.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email.";
  return null;
}

function SettingsForm({ initial }: { initial: Values }) {
  const qc = useQueryClient();
  const f = useFormState<Values>(initial);
  useUnsavedWarning(f.dirty && f.state !== "saving");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.state === "saving") return;
    for (const g of GROUPS) for (const fd of g.fields) if (fieldError(fd, f.values[g.group][fd.key])) return f.fail(`Fix "${fd.label}" in ${g.title}.`);
    f.begin();
    try {
      const changed = GROUPS;
      for (const g of changed) {
        const clean = Object.fromEntries(Object.entries(f.values[g.group]).map(([k, v]) => [k, v.trim()]));
        await saveSettingsGroup(g.group, clean);
      }
      f.markSaved(f.values);
      qc.invalidateQueries({ queryKey: ["cms", "settings"] });
      toast.success("Site settings saved");
    } catch (err) {
      f.fail(friendlyError(err));
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="System" title="Site settings" description="Company details used across the website. Leave fields empty until real information is available." />
      <form onSubmit={save} className="grid gap-6">
        {GROUPS.map((g) => (
          <Panel key={g.group} title={g.title}>
            <div className="grid gap-4 md:grid-cols-2">
              {g.fields.map((fd) => {
                const val = f.values[g.group][fd.key];
                const onChange = (v: string) => f.set(g.group, { ...f.values[g.group], [fd.key]: v });
                return fd.kind === "textarea" ? (
                  <TextArea key={fd.key} label={fd.label} value={val} onChange={(e) => onChange(e.target.value)} className="md:col-span-2" />
                ) : (
                  <TextInput key={fd.key} label={fd.label} type={fd.kind === "email" ? "email" : "text"} placeholder={fd.kind === "url" ? "https://" : undefined}
                    value={val} error={fieldError(fd, val)} onChange={(e) => onChange(e.target.value)} />
                );
              })}
            </div>
          </Panel>
        ))}
        <SaveBar state={f.state} dirty={f.dirty} error={f.error} label="Save settings" />
      </form>
    </div>
  );
}
