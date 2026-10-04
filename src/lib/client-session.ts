import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Browser-only session state for site chrome (header account area). Null until hydrated. */
export function useClientSession() {
  const [state, setState] = useState<{ ready: boolean; user: User | null }>({ ready: false, user: null });
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => alive && setState({ ready: true, user: data.session?.user ?? null }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => alive && setState({ ready: true, user: session?.user ?? null }));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
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
