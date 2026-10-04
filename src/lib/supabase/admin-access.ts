import { supabase } from "@/integrations/supabase/client";

export const ADMIN_ROLES = ["super_admin", "admin", "hr"] as const;
/** Roles with full CMS access; "hr" only sees Careers. */
export const CMS_ROLES = ["super_admin", "admin"] as const;

export type AdminSession = {
  userId: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
};

/**
 * Verifies the current session with Supabase Auth (getUser re-validates the token)
 * and reads the user's OWN roles (RLS only allows reading your own rows).
 * Returns null when there is no session or no admin role.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  if (rolesError) return null;

  const roles = (roleRows ?? []).map((r) => r.role);
  if (!roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r))) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    fullName: profile?.full_name ?? null,
    roles,
  };
}
