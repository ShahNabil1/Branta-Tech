import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, TextArea, SelectInput, CheckboxInput, SaveBar, LoadingRow, ErrorNote,
  STATUS_OPTIONS, MEDIA_TYPE_OPTIONS, SLUG_RE, useAutoSlug, useFormState, useUnsavedWarning, friendlyError, isSafeUrl, nullIfEmpty,
} from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { ServiceContentFields, ServiceRelatedWork } from "@/components/admin/ServiceFields";
import { parseServiceConfig, type ServicePageConfig } from "@/lib/services";
import { SeoFields, seoFrom, seoPayload, seoErrors, emptySeo, type SeoValues } from "@/components/admin/SeoFields";

export const Route = createFileRoute("/control-centre/_admin/services/$id")({
  head: () => adminHead("Edit service"),
  component: ServiceEditorRoute,
});

function ServiceEditorRoute() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const groups = useQuery({ queryKey: ["cms", "service_groups"], queryFn: () => must(supabase.from("service_groups").select("id,name").order("sort_order")) });
  const q = useQuery({ queryKey: ["cms", "service", id], enabled: !isNew, queryFn: () => must(supabase.from("services").select("*").eq("id", id).maybeSingle()) });
  if (groups.isLoading || (!isNew && q.isLoading)) return <LoadingRow />;
  if (groups.error || q.error) return <ErrorNote>{friendlyError(groups.error ?? q.error)}</ErrorNote>;
  if (!isNew && !q.data) return <ErrorNote>Service not found.</ErrorNote>;
  return <ServiceEditor key={id} service={isNew ? null : q.data!} groups={groups.data ?? []} />;
}

type Form = {
  name: string; group_id: string; short_description: string; description: string; hero_media_url: string; hero_media_type: string;
  hero_poster_url: string; featured: boolean; sort_order: string; status: string; seo: SeoValues; cfg: ServicePageConfig;
};
type Tab = "overview" | "content" | "media" | "work" | "seo";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" }, { key: "content", label: "Content" }, { key: "media", label: "Media" }, { key: "work", label: "Related work" }, { key: "seo", label: "SEO" },
];

function ServiceEditor({ service, groups }: { service: Tables<"services"> | null; groups: { id: string; name: string }[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !service;
  const f = useFormState<Form>({
    name: service?.name ?? "",
    group_id: service?.group_id ?? groups[0]?.id ?? "",
    short_description: service?.short_description ?? "",
    description: service?.description ?? "",
    hero_media_url: service?.hero_media_url ?? "",
    hero_media_type: service?.hero_media_type ?? "",
    hero_poster_url: service?.hero_poster_url ?? "",
    cfg: parseServiceConfig(service?.page_config),
    featured: service?.featured ?? false,
    sort_order: String(service?.sort_order ?? 0),
    status: service?.status ?? "draft",
    seo: service ? seoFrom(service) : emptySeo,
  });
  const slug = useAutoSlug(service?.slug ?? "", isNew);
  const [savedSlug, setSavedSlug] = useState(service?.slug ?? "");
  const dirty = f.dirty || slug.slug !== savedSlug;
  useUnsavedWarning(dirty && f.state !== "saving");
  const v = f.values;
  const slugError = slug.slug && !SLUG_RE.test(slug.slug) ? "Use lowercase letters, numbers and hyphens." : null;
  const mediaError = isSafeUrl(v.hero_media_url) ? null : "Unsafe or invalid URL.";
  const posterError = isSafeUrl(v.hero_poster_url) ? null : "Unsafe or invalid URL.";
  const [tab, setTab] = useState<Tab>("overview");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.state === "saving") return;
    if (!v.name.trim()) return f.fail("Name is required.");
    if (!v.group_id) return f.fail("Choose a group.");
    if (!slug.slug || slugError) return f.fail(slugError ?? "Slug is required.");
    if (mediaError || posterError) return f.fail("Fix the hero media URLs.");
    const se = seoErrors(v.seo);
    if (se.canonical_url || se.og_image_url) return f.fail("Fix the SEO URL fields.");
    f.begin();
    const payload = {
      name: v.name.trim(), slug: slug.slug, group_id: v.group_id,
      short_description: nullIfEmpty(v.short_description), description: nullIfEmpty(v.description),
      hero_media_url: nullIfEmpty(v.hero_media_url), hero_media_type: v.hero_media_type || null, hero_poster_url: nullIfEmpty(v.hero_poster_url),
      page_config: { ...(service?.page_config && typeof service.page_config === "object" ? service.page_config : {}), ...v.cfg } as never,
      featured: v.featured, sort_order: Math.round(Number(v.sort_order) || 0), status: v.status,
      ...seoPayload(v.seo),
    };
    const res = isNew
      ? await supabase.from("services").insert(payload).select("id").single()
      : await supabase.from("services").update(payload).eq("id", service.id).select("id").single();
    if (res.error) return f.fail(friendlyError(res.error));
    f.markSaved(v);
    setSavedSlug(slug.slug);
    qc.invalidateQueries({ queryKey: ["cms"] });
    toast.success("Service saved");
    if (isNew) setTimeout(() => navigate({ to: "/control-centre/services/$id", params: { id: res.data.id }, replace: true }), 0);
  }

  return (
    <div className="max-w-4xl">
      <Link to="/control-centre/services" className="text-small mb-4 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Services
      </Link>
      <PageHeader eyebrow="Website · Service" title={isNew ? "Create service" : service.name} />
      <div role="tablist" aria-label="Service sections" className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const disabled = isNew && t.key === "work";
          return (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} disabled={disabled} onClick={() => setTab(t.key)}
              className={`text-small -mb-px border-b-2 px-3 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          );
        })}
      </div>
      <form onSubmit={save} className="grid gap-6">
        <div className={tab === "overview" ? "grid gap-6" : "hidden"}>
          <Panel title="Details">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Name" required value={v.name} onChange={(e) => { f.set("name", e.target.value); slug.syncFrom(e.target.value); }} />
              <TextInput label="Slug" required value={slug.slug} error={slugError} hint="Public address: /services/slug" onChange={(e) => slug.setSlug(e.target.value)} />
              <SelectInput label="Service group" value={v.group_id} options={groups.map((g) => ({ value: g.id, label: g.name }))} onChange={(e) => f.set("group_id", e.target.value)} />
              <SelectInput label="Status" value={v.status} options={STATUS_OPTIONS} onChange={(e) => f.set("status", e.target.value)} />
              <TextArea label="Short description" hint="Shown under the name in the page header and in lists." value={v.short_description} onChange={(e) => f.set("short_description", e.target.value)} className="md:col-span-2" />
              <TextInput label="Sort order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", e.target.value)} />
              <div className="flex items-end"><CheckboxInput label="Featured" checked={v.featured} onChange={(b) => f.set("featured", b)} /></div>
            </div>
          </Panel>
        </div>
        <div className={tab === "content" ? "grid gap-6" : "hidden"}>
          <Panel title="What this service is">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Eyebrow" hint="Defaults to the group name." value={v.cfg.eyebrow} onChange={(e) => f.set("cfg", { ...v.cfg, eyebrow: e.target.value })} />
              <TextInput label="Section heading" hint="Defaults to “What <name> is”." value={v.cfg.intro_heading} onChange={(e) => f.set("cfg", { ...v.cfg, intro_heading: e.target.value })} />
              <TextArea label="Long description" value={v.description} rows={8} onChange={(e) => f.set("description", e.target.value)} className="md:col-span-2" />
              <TextArea label="Supporting copy (optional)" value={v.cfg.supporting} onChange={(e) => f.set("cfg", { ...v.cfg, supporting: e.target.value })} className="md:col-span-2" />
            </div>
          </Panel>
          <ServiceContentFields cfg={v.cfg} onChange={(cfg) => f.set("cfg", cfg)} />
        </div>
        <div className={tab === "media" ? "grid gap-6" : "hidden"}>
          <Panel title="Hero media" description="Real media only. Videos and Vimeo show the poster until the visitor presses play.">
            <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
              <TextInput label="Hero media URL" value={v.hero_media_url} error={mediaError} onChange={(e) => f.set("hero_media_url", e.target.value)} />
              <SelectInput label="Hero media type" value={v.hero_media_type} options={MEDIA_TYPE_OPTIONS} onChange={(e) => f.set("hero_media_type", e.target.value)} />
              <div className="md:col-span-2"><UploadImageButton label="Upload hero image" onUploaded={(u) => { f.set("hero_media_url", u); f.set("hero_media_type", "image"); }} /></div>
              <TextInput label="Poster image URL" hint="For video/Vimeo. Vimeo falls back to its own thumbnail." value={v.hero_poster_url} error={posterError} onChange={(e) => f.set("hero_poster_url", e.target.value)} />
              <div className="flex items-end"><UploadImageButton label="Upload poster" onUploaded={(u) => f.set("hero_poster_url", u)} /></div>
              <TextInput label="Alt text" value={v.cfg.hero_alt} onChange={(e) => f.set("cfg", { ...v.cfg, hero_alt: e.target.value })} className="md:col-span-2" />
            </div>
          </Panel>
        </div>
        <div className={tab === "work" ? "grid gap-6" : "hidden"}>
          {service && <ServiceRelatedWork serviceId={service.id} order={v.cfg.project_ids} onOrder={(ids) => f.set("cfg", { ...v.cfg, project_ids: ids })} />}
        </div>
        <div className={tab === "seo" ? "grid gap-6" : "hidden"}>
          <SeoFields values={v.seo} onChange={(k, val) => f.set("seo", { ...v.seo, [k]: val })} />
        </div>
        <SaveBar state={f.state} dirty={dirty} error={f.error} />
      </form>
    </div>
  );
}
