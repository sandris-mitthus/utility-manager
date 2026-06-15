"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/app/lib/auth/sign-in-with-google";
import { IconGoogle } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";

export function LoginGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);

    const { error: signInError } = await signInWithGoogle("/");

    if (signInError) {
      setError(formatAuthError(signInError.message));
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f5] px-4">
      <div className="flex flex-col items-center gap-3">
        <TooltipIconButton
          tooltip={loading ? "Pieslēdzas…" : "Pierakstīties ar Google"}
          icon={<IconGoogle className="size-5" />}
          variant="secondary"
          onClick={handleSignIn}
          disabled={loading}
          className="!px-4 !py-4"
        />
        {error ? (
          <p className="max-w-xs text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function formatAuthError(message: string) {
  if (message.includes("provider is not enabled") || message.includes("Unsupported provider")) {
    return "Google nav ieslēgts Supabase projektā. Authentication → Providers → Google → Enable.";
  }
  return message;
}
