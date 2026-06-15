import { createClient } from "@/app/lib/supabase/client";

export async function signOutAdmin() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  window.location.assign("/admin");
}
