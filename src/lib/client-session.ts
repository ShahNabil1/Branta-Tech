import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

/** Browser-only session state for site chrome (header account area). Null until hydrated. */
export function useClientSession() {
  const [state, setState] = useState<{ ready: boolean; user: User | null }>({ ready: false, user: null });
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    let started = false;
    const start = () => {
      if (started || !alive) return;
      started = true;
      void import("@/integrations/supabase/client").then(({ supabase }) => {
        if (!alive) return;
        void supabase.auth.getSession().then(({ data }) => alive && setState({ ready: true, user: data.session?.user ?? null }));
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => alive && setState({ ready: true, user: session?.user ?? null }));
        unsubscribe = () => sub.subscription.unsubscribe();
      });
    };
    const storedSession = Object.keys(window.localStorage).some((key) => key.startsWith("sb-") && key.endsWith("-auth-token"));
    if (storedSession) start();
    else {
      // No persisted auth token means the signed-out chrome can render immediately.
      // Keep the Supabase client deferred until interaction for initial-load performance.
      setState({ ready: true, user: null });
      window.addEventListener("pointerdown", start, { once: true, passive: true });
      window.addEventListener("keydown", start, { once: true });
    }
    return () => {
      alive = false;
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      unsubscribe?.();
    };
  }, []);
  return state;
}

export function displayName(user: User | null) {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const n = typeof m["full_name"] === "string" ? m["full_name"] : typeof m["name"] === "string" ? m["name"] : "";
  return n || user?.email?.split("@")[0] || "Account";
}

/** Only same-origin paths are allowed as post-login destinations. */
export function safeNext(v: unknown) {
  return typeof v === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) && !v.startsWith("/control-centre") ? v : "/client";
}
