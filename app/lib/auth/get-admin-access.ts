import type { AdminAccess } from "@/app/lib/auth/admin-types";
import { findAdminByEmail } from "@/app/lib/auth/admin-repository";
import { getCurrentUser } from "@/app/lib/auth/get-current-user";
import { isSupabaseConfigured } from "@/app/lib/supabase/env";

export async function getAdminAccess(): Promise<AdminAccess> {
  if (!isSupabaseConfigured()) {
    return { status: "unauthenticated" };
  }

  const user = await getCurrentUser();
  if (!user?.email) {
    return { status: "unauthenticated" };
  }

  const admin = await findAdminByEmail(user.email);
  if (!admin) {
    return { status: "forbidden", email: user.email };
  }

  return { status: "authenticated", admin };
}
