import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2, Upload } from "lucide-react";
import { FormAlert } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { getMyCurrentResumeLink, getMyResume, removeMyResume, RESUME_ACCEPT, RESUME_MAX, uploadMyResume } from "@/lib/careers.functions";
import { fmtDate } from "@/lib/applicant-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/careers/account/resume")({
  head: () => ({ meta: [{ title: "Resume — Branta Careers" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ResumePage,
});

function ResumePage() {
  const qc = useQueryClient();
  const get = useServerFn(getMyResume);
  const upload = useServerFn(uploadMyResume);
  const link = useServerFn(getMyCurrentResumeLink);
  const remove = useServerFn(removeMyResume);
  const q = useQuery({ queryKey: ["applicant", "resume"], queryFn: () => get() });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "up" | "dl" | "rm">(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const r = q.data;

  async function onPick(f: File | undefined) {
    if (input.current) input.current.value = "";
    if (!f || busy) return;
    if (!/\.(pdf|docx?)$/i.test(f.name)) return setMsg({ tone: "error", text: "Use a PDF, DOC or DOCX file." });
    if (f.size > RESUME_MAX) return setMsg({ tone: "error", text: "Maximum size is 5 MB." });
    setBusy("up"); setMsg(null);
    const fd = new FormData(); fd.set("resume", f);
    try {
      const res = await upload({ data: fd });
      if (res.ok) { qc.setQueryData(["applicant", "resume"], res.resume); setMsg({ tone: "info", text: r ? "Resume replaced." : "Resume uploaded." }); }
      else setMsg({ tone: "error", text: res.error });
    } catch { setMsg({ tone: "error", text: "Upload failed. Please try again." }); }
    setBusy(null);
  }
  async function download() {
    setBusy("dl");
    try { const { url } = await link(); if (url) window.location.assign(url); else setMsg({ tone: "error", text: "We couldn't open your resume." }); }
    catch { setMsg({ tone: "error", text: "We couldn't open your resume." }); }
    setBusy(null);
  }
  async function doRemove() {
    setBusy("rm");
    try { await remove(); qc.setQueryData(["applicant", "resume"], null); setMsg({ tone: "info", text: "Resume removed." }); }
    catch { setMsg({ tone: "error", text: "We couldn't remove your resume." }); }
    setBusy(null); setConfirm(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-h1 text-foreground">Resume</h1>
      <p className="text-body mt-3 text-muted-foreground">Keep your CV here so it's ready for any application. Only you and the Branta hiring team can see it. Applications you've already sent keep the CV you sent at the time.</p>
      {msg && <div className="mt-6"><FormAlert tone={msg.tone}>{msg.text}</FormAlert></div>}
      <div className="mt-8 rounded-md border border-border bg-surface p-6">
        {q.isLoading ? (
          <p className="text-body text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p>
        ) : r ? (
          <div className="flex items-start gap-4">
            <FileText className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-body break-all text-foreground">{r.file_name}</p>
              <p className="text-caption mt-1 text-muted-foreground">Uploaded {fmtDate(r.uploaded_at)} · {Math.ceil(r.file_size / 1024)} KB</p>
            </div>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">You haven't uploaded a resume yet.</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <input ref={input} type="file" accept={RESUME_ACCEPT} className="sr-only" id="resume-file" onChange={(e) => onPick(e.target.files?.[0])} />
          <button type="button" disabled={!!busy || q.isLoading} onClick={() => input.current?.click()} className={buttonVariants({ variant: "primary", size: "md" })}>
            {busy === "up" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}{busy === "up" ? "Uploading…" : r ? "Replace resume" : "Upload resume"}
          </button>
          {r && (
            <button type="button" disabled={!!busy} onClick={download} className={buttonVariants({ variant: "secondary", size: "md" })}>
              {busy === "dl" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Download
            </button>
          )}
          {r && !confirm && <button type="button" disabled={!!busy} onClick={() => setConfirm(true)} className={cn(buttonVariants({ variant: "ghost", size: "md" }), "text-destructive")}>Remove</button>}
        </div>
        {confirm && (
          <div className="mt-4 rounded-sm border border-border p-4">
            <p className="text-small text-foreground">Remove your saved resume? Applications you've already sent are not affected.</p>
            <div className="mt-3 flex gap-3">
              <button type="button" disabled={!!busy} onClick={doRemove} className={buttonVariants({ variant: "primary", size: "sm" })}>{busy === "rm" ? "Removing…" : "Yes, remove"}</button>
              <button type="button" onClick={() => setConfirm(false)} className={buttonVariants({ variant: "secondary", size: "sm" })}>Keep it</button>
            </div>
          </div>
        )}
        <p className="text-caption mt-6 text-muted-foreground">PDF, DOC or DOCX, up to 5 MB.</p>
      </div>
    </div>
  );
}
