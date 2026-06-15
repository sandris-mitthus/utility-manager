import { createClient } from "@/app/lib/supabase/client";

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  window.location.assign("/");
}
