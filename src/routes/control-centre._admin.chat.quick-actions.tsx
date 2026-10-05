import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, PageHeader, SelectInput, TextInput, friendlyError, nullIfEmpty } from "@/components/admin/cms";
import { SimpleCrud } from "@/components/admin/SimpleCrud";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/control-centre/_admin/chat/quick-actions")({
  head: () => adminHead("Chat quick actions"),
  component: QuickActions,
});

type Q = Tables<"chat_quick_actions">;
const TYPES = [
  { value: "intent", label: "Answer a topic (target = topic key)" }, { value: "message", label: "Send a message (target = text)" },
  { value: "portfolio", label: "Show work" }, { value: "booking", label: "Start booking" }, { value: "human", label: "Talk to a human" },
  { value: "link", label: "Open a page (target = /path)" },
];

function QuickActions() {
  const qc = useQueryClient();
  const key = ["chat", "quick"];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("chat_quick_actions").select("*").order("sort_order")) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Chat" title="Quick actions" description="Shortcut buttons shown when a visitor opens the chat." />
      <SimpleCrud<Q>
        rows={q.data} loading={q.isLoading} error={q.error} empty="No quick actions." newLabel="Add quick action"
        renderRow={(a) => <p className="text-small"><span className="font-medium">{a.label}</span> <span className="text-caption text-muted-foreground">· {a.action_type}{a.target ? ` → ${a.target}` : ""} · {a.is_published ? "Shown" : "Hidden"}</span></p>}
        renderForm={(a, close) => <Form a={a} next={((q.data?.length ?? 0) + 1) * 10} onSaved={() => { refresh(); close(); }} />}
        onDelete={async (a) => { const { error } = await supabase.from("chat_quick_actions").delete().eq("id", a.id); if (error) toast.error(friendlyError(error)); else refresh(); }}
        onMove={async (i, d) => {
          const rows = q.data ?? []; const a = rows[i], b = rows[i + d]; if (!a || !b) return;
          await Promise.all([supabase.from("chat_quick_actions").update({ sort_order: (i + d + 1) * 10 }).eq("id", a.id), supabase.from("chat_quick_actions").update({ sort_order: (i + 1) * 10 }).eq("id", b.id)]);
          refresh();
        }}
      />
    </div>
  );
}

function Form({ a, next, onSaved }: { a: Q | null; next: number; onSaved: () => void }) {
  const [v, setV] = useState({ label: a?.label ?? "", action_type: a?.action_type ?? "intent", target: a?.target ?? "", is_published: a?.is_published ?? true });
  async function save() {
    if (!v.label.trim()) return void toast.error("Label is required.");
    if (v.action_type === "link" && !/^\/\S*$/.test(v.target)) return void toast.error("Links must start with /");
    const payload = { label: v.label.trim().slice(0, 40), action_type: v.action_type, target: nullIfEmpty(v.target), is_published: v.is_published };
    const { error } = a ? await supabase.from("chat_quick_actions").update(payload).eq("id", a.id) : await supabase.from("chat_quick_actions").insert({ ...payload, sort_order: next });
    if (error) return void toast.error(friendlyError(error));
    toast.success("Saved"); onSaved();
  }
  return (
    <div className="grid gap-4">
      <TextInput label="Label" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
      <SelectInput label="Action" value={v.action_type} options={TYPES} onChange={(e) => setV({ ...v, action_type: e.target.value })} />
      <TextInput label="Target" value={v.target} onChange={(e) => setV({ ...v, target: e.target.value })} />
      <CheckboxInput label="Shown" checked={v.is_published} onChange={(c) => setV({ ...v, is_published: c })} />
      <AdminButton variant="primary" onClick={save}>Save</AdminButton>
    </div>
  );
}
