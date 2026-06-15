import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/app/lib/supabase/env";

export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient(env.url, env.anonKey);
}
