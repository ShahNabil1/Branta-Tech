import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { ClientHeader, Empty, Failed, Loading } from "@/components/client/ClientKit";
import { myFilesQuery, formatDay, formatSize, openSignedFile } from "@/lib/client-data";

export const Route = createFileRoute("/client/files")({ component: Files });

function Files() {
  const { user } = Route.useRouteContext();
  const q = useQuery(myFilesQuery(user.id));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <ClientHeader title="Shared files" intro="Files the Branta team has shared with you. Download links expire after a minute." />
      {err && <p role="alert" className="text-small mb-4 text-destructive">{err}</p>}
      {q.isLoading ? <Loading /> : q.error ? <Failed /> : q.data!.length === 0 ? <Empty>No files shared with you yet.</Empty> : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {q.data!.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-small break-words font-medium text-foreground">{f.title}</p>
                {f.description && <p className="text-caption mt-0.5 text-muted-foreground">{f.description}</p>}
                <p className="text-caption mt-0.5 text-muted-foreground">{f.file_name} · {formatSize(f.file_size)} · {formatDay(f.created_at)}</p>
              </div>
              <button onClick={() => openSignedFile(f.storage_path).catch(() => setErr("That file couldn't be opened. Please try again."))}
                className="text-small inline-flex h-9 items-center gap-2 rounded-full border border-input px-4 text-foreground hover:border-foreground">
                <Download className="size-4" aria-hidden />Download
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
