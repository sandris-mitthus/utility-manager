import { createClient } from "@/app/lib/supabase/client";
import { getSafeRedirectPath } from "@/app/lib/security/safe-redirect-path";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
}

export async function signInWithGoogle(returnPath?: string) {
  const supabase = createClient();
  const callbackUrl = new URL(`${getSiteUrl()}/auth/callback`);

  if (returnPath) {
    callbackUrl.searchParams.set("next", getSafeRedirectPath(returnPath));
  }

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });
}
