import { createClient } from "@/app/lib/supabase/client";

export async function signInWithAdmin(email: string, password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return { error };
  }

  return { error: null };
}
