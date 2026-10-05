import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  AdminButton, CheckboxInput, ConfirmButton, DataTable, EmptyState, ErrorNote, LoadingRow, PageHeader, Panel, SelectInput, Td, TextArea, TextInput,
  formatDate, friendlyError, nullIfEmpty,
} from "@/components/admin/cms";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Search = { edit?: string | undefined; q?: string | undefined; asked?: number | undefined; uq?: string | undefined };
export const Route = createFileRoute("/control-centre/_admin/chat/knowledge")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    edit: typeof s["edit"] === "string" ? s["edit"] : undefined,
    q: typeof s["q"] === "string" ? s["q"].slice(0, 500) : undefined,
    asked: Number.isFinite(Number(s["asked"])) ? Number(s["asked"]) : undefined,
    uq: typeof s["uq"] === "string" ? s["uq"] : undefined,
  }),
  head: () => adminHead("Chat knowledge base"),
  component: Knowledge,
});

type I = Tables<"chat_intents"> & { chat_intent_phrases: { phrase: string }[] };
export const TOPICS = ["Services", "Pricing", "Process", "Portfolio", "Company", "Booking", "Support", "Careers", "Timeline", "Payment", "Revisions", "Technology", "AI", "Other"];
const LANGS = [{ value: "any", label: "Any" }, { value: "en", label: "English" }, { value: "bn", label: "Bangla" }, { value: "banglish", label: "Banglish" }];
const PHRASE_LANGS = LANGS.filter((l) => l.value !== "any");
const BEHAVIOUR = [{ value: "", label: "Answer only" }, { value: "portfolio", label: "Show portfolio cards" }, { value: "booking", label: "Start booking" }, { value: "human", label: "Hand off to a human" }];
const ACTIONS = [
  { key: "explore_service", label: "Explore Service" }, { key: "view_work", label: "View Work" }, { key: "book_call", label: "Book a Call" },
  { key: "talk_human", label: "Talk to Human" }, { key: "open_careers", label: "Open Careers" }, { key: "open_contact", label: "Open Contact" },
];
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function Knowledge() {
  const search = Route.useSearch();
  const q = useQuery({ queryKey: ["chat", "intents"], queryFn: () => must(supabase.from("chat_intents").select("*, chat_intent_phrases(phrase)").order("priority", { ascending: false }).order("name")) as Promise<I[]> });
  const groups = useQuery({ queryKey: ["chat", "groups"], queryFn: () => must(supabase.from("service_groups").select("id,name").order("sort_order")) });
  const services = useQuery({ queryKey: ["chat", "svc"], queryFn: () => must(supabase.from("services").select("id,name,group_id").order("name")) });
  const cats = useQuery({ queryKey: ["chat", "cats"], queryFn: () => must(supabase.from("portfolio_categories").select("id,name").order("name")) });
  const refs = { groups: groups.data ?? [], services: services.data ?? [], cats: cats.data ?? [] };
  if (search.edit) {
    const entry = search.edit === "new" ? null : q.data?.find((i) => i.id === search.edit);
    if (search.edit !== "new" && q.isLoading) return <LoadingRow />;
    if (search.edit !== "new" && !entry) return <ErrorNote>Entry not found.</ErrorNote>;
    return <Editor key={search.edit} entry={entry ?? null} refs={refs} prefill={search} topics={[...new Set([...TOPICS, ...(q.data ?? []).map((i) => i.topic)])]} />;
  }
  return <List rows={q.data} loading={q.isLoading} error={q.error} refs={refs} />;
}

function List({ rows, loading, error, refs }: { rows: I[] | undefined; loading: boolean; error: unknown; refs: { groups: { id: string; name: string }[]; services: { id: string; name: string }[] } }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [lang, setLang] = useState("");
  const [status, setStatus] = useState("");
  const [group, setGroup] = useState("");
  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return (rows ?? []).filter((i) =>
      (!topic || i.topic === topic) && (!lang || i.lang === lang) && (!status || (status === "published") === i.is_published) && (!group || i.service_group_id === group) &&
      (!t || [i.name, i.question ?? "", i.answer, i.answer_bn ?? "", ...i.chat_intent_phrases.map((p) => p.phrase)].some((x) => x.toLowerCase().includes(t))));
  }, [rows, text, topic, lang, status, group]);
  const topics = [...new Set((rows ?? []).map((i) => i.topic))].sort();
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name;
  return (
    <div className="max-w-7xl">
      <PageHeader eyebrow="Chat" title="Knowledge Base" description="Approved answers Branta Assistant can give. Only published entries are used; each is matched by its training phrases."
        actions={<AdminButton variant="primary" onClick={() => navigate({ to: "/control-centre/chat/knowledge", search: { edit: "new" } })}>Add entry</AdminButton>} />
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <TextInput label="Search" placeholder="Title, question, phrase, answer" value={text} onChange={(e) => setText(e.target.value)} />
        <SelectInput label="Topic" value={topic} options={[{ value: "", label: "All topics" }, ...topics.map((t) => ({ value: t, label: t }))]} onChange={(e) => setTopic(e.target.value)} />
        <SelectInput label="Language" value={lang} options={[{ value: "", label: "All" }, ...LANGS]} onChange={(e) => setLang(e.target.value)} />
        <SelectInput label="Status" value={status} options={[{ value: "", label: "All" }, { value: "published", label: "Published" }, { value: "draft", label: "Draft" }]} onChange={(e) => setStatus(e.target.value)} />
        <SelectInput label="Service category" value={group} options={[{ value: "", label: "All" }, ...refs.groups.map((g) => ({ value: g.id, label: g.name }))]} onChange={(e) => setGroup(e.target.value)} />
      </div>
      {loading && <LoadingRow />}
      {!!error && <ErrorNote>{friendlyError(error)}</ErrorNote>}
      {rows && shown.length === 0 && <EmptyState>No entries match.</EmptyState>}
      {shown.length > 0 && (
        <DataTable head={["Title", "Topic", "Language", "Related service", "Priority", "Status", "Updated"]}>
          {shown.map((i) => (
            <tr key={i.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/control-centre/chat/knowledge", search: { edit: i.id } })}>
              <Td><span className="font-medium">{i.name}</span><span className="text-caption block text-muted-foreground">{i.chat_intent_phrases.length} phrases{i.action ? ` · ${i.action}` : ""}</span></Td>
              <Td>{i.topic}</Td>
              <Td>{LANGS.find((l) => l.value === i.lang)?.label}</Td>
              <Td>{name(refs.services, i.service_id) ?? name(refs.groups, i.service_group_id) ?? "—"}</Td>
              <Td>{i.priority}</Td>
              <Td><span className={cn("text-caption rounded-sm px-1.5 py-0.5", i.is_published ? "bg-accent/15 text-foreground" : "bg-muted text-muted-foreground")}>{i.is_published ? "Published" : "Draft"}</span></Td>
              <Td>{formatDate(i.updated_at)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

type Refs = { groups: { id: string; name: string }[]; services: { id: string; name: string; group_id: string }[]; cats: { id: string; name: string }[] };
const SECTIONS = ["Basics", "Answer", "Training Phrases", "Relationships", "Actions", "Publishing"] as const;

function Editor({ entry, refs, prefill, topics }: { entry: I | null; refs: Refs; prefill: Search; topics: string[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Basics");
  const [v, setV] = useState({
    name: entry?.name ?? (prefill.q ? prefill.q.slice(0, 80) : ""), key: entry?.key ?? "", topic: entry?.topic ?? "Other", question: entry?.question ?? prefill.q ?? "",
    lang: entry?.lang ?? "any", answer: entry?.answer ?? "", answer_bn: entry?.answer_bn ?? "", follow_up: entry?.follow_up ?? "",
    service_group_id: entry?.service_group_id ?? "", service_id: entry?.service_id ?? "", category_id: entry?.category_id ?? "",
    quick_replies: strs(entry?.quick_replies).join("\n"), suggested: strs(entry?.suggested_actions),
    ctas: (Array.isArray(entry?.ctas) ? (entry!.ctas as { label?: string; url?: string }[]) : []).map((c) => `${c.label ?? ""} | ${c.url ?? ""}`).join("\n"),
    action: entry?.action ?? "", priority: String(entry?.priority ?? 0), is_published: entry?.is_published ?? false, admin_notes: entry?.admin_notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const groupServices = refs.services.filter((s) => !v.service_group_id || s.group_id === v.service_group_id);

  async function save() {
    const key = (v.key || v.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
    if (!v.name.trim() || !key) { setSection("Basics"); return void toast.error("Title is required."); }
    if (!v.answer.trim() && !v.action) { setSection("Answer"); return void toast.error("Add an approved answer."); }
    const ctas = v.ctas.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter(([l, u]) => l && u);
    if (ctas.some(([, u]) => !/^\/[^\s]*$|^https:\/\/\S+$/.test(u!))) { setSection("Actions"); return void toast.error("Button links must start with / or https://"); }
    setBusy(true);
    const payload = {
      name: v.name.trim(), key, topic: v.topic.trim() || "Other", question: nullIfEmpty(v.question), lang: v.lang,
      answer: v.answer.trim(), answer_bn: nullIfEmpty(v.answer_bn), follow_up: nullIfEmpty(v.follow_up),
      service_group_id: v.service_group_id || null, service_id: v.service_id || null, category_id: v.category_id || null,
      quick_replies: v.quick_replies.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 6), suggested_actions: v.suggested,
      ctas: ctas.map(([label, url]) => ({ label, url })), action: v.action || null, priority: Math.round(Number(v.priority) || 0),
      is_published: v.is_published, admin_notes: nullIfEmpty(v.admin_notes),
    };
    const res = entry ? await supabase.from("chat_intents").update(payload).eq("id", entry.id).select("id").single() : await supabase.from("chat_intents").insert(payload).select("id").single();
    if (res.error) { setBusy(false); return void toast.error(friendlyError(res.error)); }
    if (!entry) {
      // From an unanswered question: keep the original wording as the first training phrase and mark it resolved.
      if (prefill.q) await supabase.from("chat_intent_phrases").insert({ intent_id: res.data.id, phrase: prefill.q.slice(0, 200), lang: /[\u0980-\u09FF]/.test(prefill.q) ? "bn" : "en" });
      if (prefill.uq) await supabase.from("chat_unanswered_questions").update({ resolved: true, resolved_intent_id: res.data.id }).eq("id", prefill.uq);
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["chat"] });
    toast.success("Entry saved");
    if (!entry) navigate({ to: "/control-centre/chat/knowledge", search: { edit: res.data.id }, replace: true });
  }

  async function remove() {
    if (!entry) return;
    const { error } = await supabase.from("chat_intents").delete().eq("id", entry.id);
    if (error) return void toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ["chat"] });
    navigate({ to: "/control-centre/chat/knowledge", search: {} });
  }

  return (
    <div className="max-w-4xl">
      <button type="button" onClick={() => navigate({ to: "/control-centre/chat/knowledge", search: {} })} className="text-small mb-4 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Knowledge Base</button>
      <PageHeader eyebrow="Chat · Knowledge entry" title={entry ? entry.name : "New knowledge entry"}
        description={prefill.q && !entry ? `From an unanswered question${prefill.asked ? ` (asked ${prefill.asked}×)` : ""}. Add the approved answer and publish.` : undefined}
        actions={entry && <ConfirmButton title="Delete this entry?" description="Its training phrases are deleted too." onConfirm={remove}>Delete</ConfirmButton>} />
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {SECTIONS.map((x) => (
          <button key={x} role="tab" type="button" aria-selected={section === x} onClick={() => setSection(x)}
            className={cn("text-small -mb-px border-b-2 px-3 py-2", section === x ? "border-accent font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{x}</button>
        ))}
      </div>
      <Panel>
        {section === "Basics" && <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Title" required value={v.name} onChange={(e) => set("name", e.target.value)} />
          <TextInput label="Topic" list="kb-topics" hint="Pick one or type a new topic." value={v.topic} onChange={(e) => set("topic", e.target.value)} />
          <datalist id="kb-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
          <TextInput className="md:col-span-2" label="Main question / intent" placeholder="Do you build websites?" value={v.question} onChange={(e) => set("question", e.target.value)} />
          <SelectInput label="Language" value={v.lang} options={LANGS} onChange={(e) => set("lang", e.target.value)} />
          <TextInput label="Internal key" hint="Generated from the title if empty." value={v.key} onChange={(e) => set("key", e.target.value)} />
        </div>}
        {section === "Answer" && <div className="grid gap-4">
          <TextArea label="Approved answer (English)" value={v.answer} onChange={(e) => set("answer", e.target.value)} />
          <TextArea label="Approved answer (Bangla, optional)" hint="Used when the visitor writes in Bangla." value={v.answer_bn} onChange={(e) => set("answer_bn", e.target.value)} />
          <TextInput label="Follow-up question (optional)" value={v.follow_up} onChange={(e) => set("follow_up", e.target.value)} />
        </div>}
        {section === "Training Phrases" && (entry
          ? <Phrases intentId={entry.id} />
          : <EmptyState>Save the entry first, then add training phrases.{prefill.q ? " The original question will be added automatically." : ""}</EmptyState>)}
        {section === "Relationships" && <div className="grid gap-4 md:grid-cols-2">
          <SelectInput label="Related service category" value={v.service_group_id} options={[{ value: "", label: "— None —" }, ...refs.groups.map((g) => ({ value: g.id, label: g.name }))]}
            onChange={(e) => { const g = e.target.value; setV((p) => ({ ...p, service_group_id: g, service_id: refs.services.find((s) => s.id === p.service_id)?.group_id === g ? p.service_id : "" })); }} />
          <SelectInput label="Related service" value={v.service_id} options={[{ value: "", label: "— None —" }, ...groupServices.map((s) => ({ value: s.id, label: s.name }))]} onChange={(e) => set("service_id", e.target.value)} />
          <SelectInput label="Related portfolio category" value={v.category_id} options={[{ value: "", label: "— None —" }, ...refs.cats.map((c) => ({ value: c.id, label: c.name }))]} onChange={(e) => set("category_id", e.target.value)} />
          <p className="text-caption text-muted-foreground md:col-span-2">Service details always come from Control Centre → Services; this only links the answer to them. A related service also preselects it when the visitor books from the chat.</p>
        </div>}
        {section === "Actions" && <div className="grid gap-4">
          <div><p className="text-small mb-2 font-medium">Suggested actions</p><div className="flex flex-wrap gap-4">
            {ACTIONS.map((a) => <CheckboxInput key={a.key} label={a.label} checked={v.suggested.includes(a.key)} onChange={(c) => set("suggested", c ? [...v.suggested, a.key] : v.suggested.filter((x) => x !== a.key))} />)}
          </div></div>
          <SelectInput label="Behaviour" value={v.action} options={BEHAVIOUR} onChange={(e) => set("action", e.target.value)} />
          <TextArea label="Extra quick replies (one per line, max 6)" value={v.quick_replies} onChange={(e) => set("quick_replies", e.target.value)} />
          <TextArea label="Extra buttons (one per line: Label | /link)" value={v.ctas} onChange={(e) => set("ctas", e.target.value)} />
        </div>}
        {section === "Publishing" && <div className="grid gap-4 md:grid-cols-2">
          <CheckboxInput label="Published" hint="Draft entries are never used by the chatbot." checked={v.is_published} onChange={(c) => set("is_published", c)} />
          <TextInput label="Priority" type="number" hint="Higher wins when several entries match." value={v.priority} onChange={(e) => set("priority", e.target.value)} />
          <TextArea className="md:col-span-2" label="Admin notes (internal only)" value={v.admin_notes} onChange={(e) => set("admin_notes", e.target.value)} />
          {entry && <p className="text-caption text-muted-foreground">Last updated {formatDate(entry.updated_at)}</p>}
        </div>}
      </Panel>
      <div className="mt-4"><AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save entry"}</AdminButton></div>
    </div>
  );
}

function Phrases({ intentId }: { intentId: string }) {
  const qc = useQueryClient();
  const key = ["chat", "phrases", intentId];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("chat_intent_phrases").select("*").eq("intent_id", intentId).order("sort_order").order("created_at")) });
  const [phrase, setPhrase] = useState("");
  const [lang, setLang] = useState("en");
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["chat", "intents"] }); };
  async function add() {
    const lines = phrase.split("\n").map((x) => x.trim().slice(0, 200)).filter(Boolean);
    if (!lines.length) return;
    const { error } = await supabase.from("chat_intent_phrases").insert(lines.map((p, i) => ({ intent_id: intentId, phrase: p, lang: /[\u0980-\u09FF]/.test(p) ? "bn" : lang, sort_order: ((q.data?.length ?? 0) + i) * 10 })));
    if (error) return void toast.error(friendlyError(error));
    setPhrase(""); refresh();
  }
  async function edit(id: string, value: string) {
    if (!value.trim()) return;
    const { error } = await supabase.from("chat_intent_phrases").update({ phrase: value.trim().slice(0, 200) }).eq("id", id);
    if (error) toast.error(friendlyError(error)); else refresh();
  }
  return (
    <div>
      <p className="text-small text-muted-foreground">Add every way a visitor might ask this — English, Bangla or Banglish. Paste several at once, one per line.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select aria-label="Phrase language" value={lang} onChange={(e) => setLang(e.target.value)} className="h-10 rounded-sm border border-input bg-background px-2 text-small">{PHRASE_LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
        <textarea rows={2} value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={"website lagbe\nwebsite বানাতে চাই"} className="text-small min-w-0 flex-1 rounded-sm border border-input bg-background px-2 py-1.5" />
        <AdminButton onClick={add}>Add</AdminButton>
      </div>
      <ul className="mt-4 grid gap-1.5">
        {q.data?.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="text-caption w-16 shrink-0 text-muted-foreground">{p.lang}</span>
            <input aria-label="Phrase" defaultValue={p.phrase} onBlur={(e) => e.target.value !== p.phrase && edit(p.id, e.target.value)} className="text-small h-8 min-w-0 flex-1 rounded-sm border border-input bg-background px-2" />
            <ConfirmButton title="Delete phrase?" description={p.phrase} onConfirm={async () => { await supabase.from("chat_intent_phrases").delete().eq("id", p.id); refresh(); }}>×</ConfirmButton>
          </li>
        ))}
      </ul>
      {q.data?.length === 0 && <p className="text-caption mt-3 text-muted-foreground">No phrases yet — this entry can't be matched until you add some.</p>}
    </div>
  );
}
