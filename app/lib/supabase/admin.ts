import { createClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";

export function createAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase admin env is missing. Set SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
