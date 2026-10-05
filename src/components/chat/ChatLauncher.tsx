import { lazy, Suspense, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

const ChatPanel = lazy(() => import("./ChatPanel"));

/** Floating "Ask Branta" button. The chat panel code loads only after the first click. */
export function ChatLauncher() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return (
    <>
      {!open && (
        <button type="button" onClick={() => { setLoaded(true); setOpen(true); }}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-small font-medium text-background shadow-[0_12px_30px_-12px_rgb(0_0_0/0.45)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-accent md:right-6 md:bottom-6">
          <MessageCircle className="size-4 text-accent" aria-hidden /> Ask Branta
        </button>
      )}
      {loaded && <Suspense fallback={null}><ChatPanel open={open} onClose={() => setOpen(false)} /></Suspense>}
    </>
  );
}
