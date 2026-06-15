"use client";

import { FormEvent, useState } from "react";
import { signInWithAdmin } from "@/app/lib/auth/sign-in-admin";
import { signOutAdmin } from "@/app/lib/auth/sign-out-admin";
import {
  FeedbackToast,
  type FeedbackToastVariant,
} from "@/app/components/ui/feedback-toast";
import { labelClassName } from "@/app/components/ui/form-styles";
import { ActionButton } from "@/app/components/ui/action-button";
import { IconInput, PasswordInput } from "@/app/components/ui/icon-input";
import { IconLock, IconMail } from "@/app/components/ui/icons";

type AdminLoginGateProps = {
  forbiddenEmail?: string | null;
  supabaseMissing?: boolean;
};

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

export function AdminLoginGate({ forbiddenEmail, supabaseMissing }: AdminLoginGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    const { error: signInError } = await signInWithAdmin(email, password);

    if (signInError) {
      setFeedback({
        message: formatAdminAuthError(signInError.message),
        variant: "error",
      });
      setLoading(false);
      return;
    }

    window.location.assign("/admin");
  }

  async function handleClearSession() {
    setLoading(true);
    setFeedback(null);
    try {
      await signOutAdmin();
    } catch {
      setLoading(false);
      setFeedback({
        message: "Neizdevās beigt sesiju. Mēģiniet vēlreiz.",
        variant: "error",
      });
    }
  }

  if (supabaseMissing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-zinc-100 to-zinc-200/80 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
          <h1 className="text-lg font-semibold text-zinc-900">Supabase nav konfigurēts</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Aizpildiet `.env.local` ar Supabase URL un atslēgām, pēc tam palaidiet migrācijas un{" "}
            <code className="text-zinc-800">npm run db:seed-admin</code>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-zinc-100 to-zinc-200/80 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <IconLock className="size-5" />
            </span>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              Administratora pieslēgšanās
            </h1>
          </div>

          {forbiddenEmail ? (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p>
                Konts <span className="font-medium">{forbiddenEmail}</span> nav administratoru sarakstā.
              </p>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-amber-950 underline"
                onClick={handleClearSession}
                disabled={loading}
              >
                Beigt sesiju un pierakstīties ar citu kontu
              </button>
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="admin-email" className={labelClassName}>
                E-pasts
              </label>
              <IconInput
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ievadiet@epasts.lv"
                icon={<IconMail className="size-4" />}
                wrapperClassName="mt-1.5"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-password" className={labelClassName}>
                Parole
              </label>
              <PasswordInput
                id="admin-password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="ievadiet paroli"
                wrapperClassName="mt-1.5"
                required
              />
            </div>

            <ActionButton
              type="submit"
              variant="primary"
              className="w-full !py-3"
              loading={loading}
              disabled={loading}
            >
              Pierakstīties
            </ActionButton>
          </form>
        </div>
      </main>

      {feedback ? (
        <FeedbackToast
          message={feedback.message}
          variant={feedback.variant}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}
    </>
  );
}

function formatAdminAuthError(message: string) {
  if (message.includes("Invalid login credentials")) {
    return "Nepareizs e-pasts vai parole.";
  }

  if (message.includes("Email not confirmed")) {
    return "E-pasts nav apstiprināts. Palaidiet npm run db:seed-admin vai apstipriniet lietotāju Supabase.";
  }

  if (message.includes("Email logins are disabled")) {
    return "E-pasta pieslēgšana nav ieslēgta Supabase projektā. Authentication → Providers → Email → Enable.";
  }

  return message;
}
