import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, DataTable, EmptyState, ErrorNote, LoadingRow, PageHeader, Td, friendlyError } from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/chat/unanswered")({
  head: () => adminHead("Unanswered questions"),
  component: Unanswered,
});

function Unanswered() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showResolved, setShowResolved] = useState(false);
  const q = useQuery({ queryKey: ["chat", "unanswered", showResolved], queryFn: () => must(supabase.from("chat_unanswered_questions").select("*").eq("resolved", showResolved).order("count", { ascending: false }).order("last_asked_at", { ascending: false }).limit(300)) });
  const intents = useQuery({ queryKey: ["chat", "intents-min"], queryFn: () => must(supabase.from("chat_intents").select("id,name").order("name")) });
  const [pick, setPick] = useState<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["chat", "unanswered"] });

  async function teach(id: string, question: string) {
    const intentId = pick[id];
    if (!intentId) return void toast.error("Choose a topic first.");
    const lang = /[\u0980-\u09FF]/.test(question) ? "bn" : "en";
    const { error } = await supabase.from("chat_intent_phrases").insert({ intent_id: intentId, phrase: question.slice(0, 200), lang });
    if (error) return void toast.error(friendlyError(error));
    await supabase.from("chat_unanswered_questions").update({ resolved: true, resolved_intent_id: intentId }).eq("id", id);
    toast.success("Added as an example phrase"); refresh();
  }
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Chat" title="Unanswered questions" description="Questions the assistant could not match. Add them to a topic so it can answer next time."
        actions={<AdminButton onClick={() => setShowResolved((s) => !s)}>{showResolved ? "Show open" : "Show resolved"}</AdminButton>} />
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data?.length === 0 && <EmptyState>Nothing here.</EmptyState>}
      {!!q.data?.length && (
        <DataTable head={["Question", "Times", "Last asked", showResolved ? "" : "Teach"]}>
          {q.data.map((u) => (
            <tr key={u.id}>
              <Td className="max-w-md">{u.question}</Td>
              <Td>{u.count}</Td>
              <Td>{new Date(u.last_asked_at).toLocaleString()}</Td>
              <Td>{!showResolved && (
                <div className="flex flex-wrap gap-1">
                  <select className="h-8 rounded-sm border border-input bg-background px-2 text-caption" value={pick[u.id] ?? ""} onChange={(e) => setPick({ ...pick, [u.id]: e.target.value })}>
                    <option value="">Add to entry…</option>
                    {intents.data?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <AdminButton size="sm" onClick={() => teach(u.id, u.question)}>Add phrase</AdminButton>
                  <AdminButton size="sm" variant="primary" onClick={() => navigate({ to: "/control-centre/chat/knowledge", search: { edit: "new", q: u.question, asked: u.count, uq: u.id } })}>Create Knowledge Entry</AdminButton>
                  <AdminButton size="sm" variant="ghost" onClick={async () => { await supabase.from("chat_unanswered_questions").update({ resolved: true }).eq("id", u.id); refresh(); }}>Dismiss</AdminButton>
                </div>
              )}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
