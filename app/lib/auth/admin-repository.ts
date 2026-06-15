import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import type { AdminUser } from "@/app/lib/auth/admin-types";

function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  const normalized = normalizeAdminEmail(email);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, auth_user_id")
    .eq("email", normalized)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    authUserId: data.auth_user_id,
  };
}

export async function linkAdminAuthUser(email: string, authUserId: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) {
    return;
  }

  const supabase = createAdminClient();
  await supabase
    .from("admin_users")
    .update({ auth_user_id: authUserId })
    .eq("email", normalizeAdminEmail(email));
}
