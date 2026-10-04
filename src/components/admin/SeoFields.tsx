import { Panel, TextInput, TextArea, CheckboxInput, isSafeUrl } from "@/components/admin/cms";

export type SeoValues = {
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  og_image_url: string;
  noindex: boolean;
};

export const emptySeo: SeoValues = { meta_title: "", meta_description: "", canonical_url: "", og_image_url: "", noindex: false };

export function seoFrom(r: Partial<Record<keyof SeoValues, unknown>>): SeoValues {
  return {
    meta_title: (r.meta_title as string) ?? "",
    meta_description: (r.meta_description as string) ?? "",
    canonical_url: (r.canonical_url as string) ?? "",
    og_image_url: (r.og_image_url as string) ?? "",
    noindex: Boolean(r.noindex),
  };
}

export function seoErrors(v: SeoValues) {
  return {
    canonical_url: isSafeUrl(v.canonical_url, { allowInternal: false }) ? null : "Use a full https:// URL.",
    og_image_url: isSafeUrl(v.og_image_url, { allowInternal: false }) ? null : "Use a full https:// URL.",
  };
}

export function SeoFields({ values, onChange }: { values: SeoValues; onChange: <K extends keyof SeoValues>(k: K, v: SeoValues[K]) => void }) {
  const errs = seoErrors(values);
  return (
    <Panel title="SEO" description="Leave empty to use defaults.">
      <div className="grid gap-4">
        <TextInput label="Meta title" value={values.meta_title} maxLength={70} hint={`${values.meta_title.length}/60 recommended`} onChange={(e) => onChange("meta_title", e.target.value)} />
        <TextArea label="Meta description" value={values.meta_description} maxLength={200} hint={`${values.meta_description.length}/160 recommended`} onChange={(e) => onChange("meta_description", e.target.value)} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Canonical URL" value={values.canonical_url} error={errs.canonical_url} placeholder="https://" onChange={(e) => onChange("canonical_url", e.target.value)} />
          <TextInput label="OG image URL" value={values.og_image_url} error={errs.og_image_url} placeholder="https://" onChange={(e) => onChange("og_image_url", e.target.value)} />
        </div>
        <CheckboxInput label="Noindex" hint="Ask search engines not to index this." checked={values.noindex} onChange={(v) => onChange("noindex", v)} />
      </div>
    </Panel>
  );
}

export function seoPayload(v: SeoValues) {
  const n = (s: string) => (s.trim() ? s.trim() : null);
  return {
    meta_title: n(v.meta_title),
    meta_description: n(v.meta_description),
    canonical_url: n(v.canonical_url),
    og_image_url: n(v.og_image_url),
    noindex: v.noindex,
  };
}
