import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, ConfirmButton, PageHeader, SelectInput, TextArea, TextInput, friendlyError, nullIfEmpty } from "@/components/admin/cms";
import { SimpleCrud } from "@/components/admin/SimpleCrud";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/control-centre/_admin/chat/knowledge")({
  head: () => adminHead("Chat knowledge base"),
  component: Knowledge,
});

type I = Tables<"chat_intents">;
const ACTIONS = [{ value: "", label: "Answer only" }, { value: "portfolio", label: "Show portfolio cards" }, { value: "booking", label: "Start booking" }, { value: "human", label: "Hand off to a human" }];
const LANGS = [{ value: "en", label: "English" }, { value: "bn", label: "Bangla" }, { value: "banglish", label: "Banglish" }];
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function Knowledge() {
  const qc = useQueryClient();
  const key = ["chat", "intents"];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("chat_intents").select("*").order("priority", { ascending: false }).order("name")) });
  const services = useQuery({ queryKey: ["chat", "svc"], queryFn: () => must(supabase.from("services").select("id,name").order("name")) });
  const cats = useQuery({ queryKey: ["chat", "cats"], queryFn: () => must(supabase.from("portfolio_categories").select("id,name").order("name")) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Chat" title="Knowledge base" description="Branta Assistant only answers from these topics. Each topic is matched by its example phrases (English, Bangla, Banglish). Higher priority wins ties." />
      <SimpleCrud<I>
        rows={q.data} loading={q.isLoading} error={q.error} empty="No topics yet." newLabel="Add topic"
        renderRow={(i) => (
          <div>
            <p className="text-small font-medium">{i.name} <span className="text-caption font-mono text-muted-foreground">{i.key}</span></p>
            <p className="text-caption line-clamp-1 text-muted-foreground">{i.is_published ? "Published" : "Draft"} · priority {i.priority}{i.action ? ` · ${i.action}` : ""} · {i.answer}</p>
          </div>
        )}
        renderForm={(i, close) => <IntentForm i={i} services={services.data ?? []} cats={cats.data ?? []} onSaved={() => { refresh(); if (!i) close(); }} />}
        onDelete={async (i) => { const { error } = await supabase.from("chat_intents").delete().eq("id", i.id); if (error) toast.error(friendlyError(error)); else { toast.success("Topic deleted"); refresh(); } }}
        onMove={async (idx, d) => {
          const rows = q.data ?? []; const a = rows[idx], b = rows[idx + d]; if (!a || !b) return;
          await Promise.all([supabase.from("chat_intents").update({ priority: b.priority }).eq("id", a.id), supabase.from("chat_intents").update({ priority: a.priority }).eq("id", b.id)]);
          refresh();
        }}
      />
    </div>
  );
}

function IntentForm({ i, services, cats, onSaved }: { i: I | null; services: { id: string; name: string }[]; cats: { id: string; name: string }[]; onSaved: () => void }) {
  const [v, setV] = useState({
    name: i?.name ?? "", key: i?.key ?? "", answer: i?.answer ?? "", answer_bn: i?.answer_bn ?? "", follow_up: i?.follow_up ?? "",
    service_id: i?.service_id ?? "", category_id: i?.category_id ?? "", quick_replies: list(i?.quick_replies).join("\n"),
    ctas: (Array.isArray(i?.ctas) ? (i!.ctas as { label?: string; url?: string }[]) : []).map((c) => `${c.label ?? ""} | ${c.url ?? ""}`).join("\n"),
    action: i?.action ?? "", priority: String(i?.priority ?? 0), is_published: i?.is_published ?? true,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  async function save() {
    const k = (v.key || v.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!v.name.trim() || !k) return void toast.error("Name is required.");
    const ctas = v.ctas.split("\n").map((l) => l.split("|").map((s) => s.trim())).filter(([l, u]) => l && u);
    if (ctas.some(([, u]) => !/^\/[^\s]*$|^https:\/\/\S+$/.test(u!))) return void toast.error("Button links must start with / or https://");
    setBusy(true);
    const payload = {
      name: v.name.trim(), key: k, answer: v.answer.trim(), answer_bn: nullIfEmpty(v.answer_bn), follow_up: nullIfEmpty(v.follow_up),
      service_id: v.service_id || null, category_id: v.category_id || null,
      quick_replies: v.quick_replies.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6), ctas: ctas.map(([label, url]) => ({ label, url })),
      action: v.action || null, priority: Math.round(Number(v.priority) || 0), is_published: v.is_published,
    };
    const { error } = i ? await supabase.from("chat_intents").update(payload).eq("id", i.id) : await supabase.from("chat_intents").insert(payload);
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Topic saved"); onSaved();
  }
  return (
    <div className="grid gap-4">
      <TextInput label="Topic name" value={v.name} onChange={(e) => set("name", e.target.value)} />
      <TextInput label="Internal key" hint="Lowercase, e.g. service_website. Generated from the name if empty." value={v.key} onChange={(e) => set("key", e.target.value)} />
      <TextArea label="Answer (English)" value={v.answer} onChange={(e) => set("answer", e.target.value)} />
      <TextArea label="Answer (Bangla, optional)" value={v.answer_bn} onChange={(e) => set("answer_bn", e.target.value)} />
      <TextInput label="Follow-up question (optional)" value={v.follow_up} onChange={(e) => set("follow_up", e.target.value)} />
      <SelectInput label="Behaviour" value={v.action} options={ACTIONS} onChange={(e) => set("action", e.target.value)} />
      <SelectInput label="Related service (optional)" value={v.service_id} options={[{ value: "", label: "— None —" }, ...services.map((s) => ({ value: s.id, label: s.name }))]} onChange={(e) => set("service_id", e.target.value)} />
      <SelectInput label="Related portfolio category (optional)" value={v.category_id} options={[{ value: "", label: "— None —" }, ...cats.map((s) => ({ value: s.id, label: s.name }))]} onChange={(e) => set("category_id", e.target.value)} />
      <TextArea label="Quick replies (one per line, max 6)" value={v.quick_replies} onChange={(e) => set("quick_replies", e.target.value)} />
      <TextArea label="Buttons (one per line: Label | /link)" value={v.ctas} onChange={(e) => set("ctas", e.target.value)} />
      <TextInput label="Priority" type="number" value={v.priority} onChange={(e) => set("priority", e.target.value)} />
      <CheckboxInput label="Published" checked={v.is_published} onChange={(c) => set("is_published", c)} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save topic"}</AdminButton>
      {i && <Phrases intentId={i.id} />}
    </div>
  );
}

function Phrases({ intentId }: { intentId: string }) {
  const qc = useQueryClient();
  const key = ["chat", "phrases", intentId];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("chat_intent_phrases").select("*").eq("intent_id", intentId).order("sort_order").order("created_at")) });
  const [phrase, setPhrase] = useState("");
  const [lang, setLang] = useState("en");
  async function add() {
    const p = phrase.trim().slice(0, 200);
    if (!p) return;
    const { error } = await supabase.from("chat_intent_phrases").insert({ intent_id: intentId, phrase: p, lang, sort_order: (q.data?.length ?? 0) * 10 });
    if (error) return void toast.error(friendlyError(error));
    setPhrase(""); qc.invalidateQueries({ queryKey: key });
  }
  async function edit(id: string, value: string) {
    const { error } = await supabase.from("chat_intent_phrases").update({ phrase: value.trim().slice(0, 200) }).eq("id", id);
    if (error) toast.error(friendlyError(error)); else qc.invalidateQueries({ queryKey: key });
  }
  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-small mb-2 font-semibold">Example phrases ({q.data?.length ?? 0})</h3>
      <ul className="grid gap-1.5">
        {q.data?.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="text-caption w-16 shrink-0 text-muted-foreground">{p.lang}</span>
            <input defaultValue={p.phrase} onBlur={(e) => e.target.value !== p.phrase && edit(p.id, e.target.value)} className="text-small h-8 min-w-0 flex-1 rounded-sm border border-input bg-background px-2" />
            <ConfirmButton title="Delete phrase?" description={p.phrase} onConfirm={async () => { await supabase.from("chat_intent_phrases").delete().eq("id", p.id); qc.invalidateQueries({ queryKey: key }); }}>×</ConfirmButton>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="h-9 rounded-sm border border-input bg-background px-2 text-small">{LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
        <input value={phrase} onChange={(e) => setPhrase(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} placeholder="e.g. website lagbe" className="text-small h-9 min-w-0 flex-1 rounded-sm border border-input bg-background px-2" />
        <AdminButton size="sm" onClick={add}>Add</AdminButton>
      </div>
    </div>
  );
}
