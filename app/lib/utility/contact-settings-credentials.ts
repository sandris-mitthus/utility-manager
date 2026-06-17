import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import { deriveImapHostFromSmtpHost, getContactImapHostFromEnv } from "@/app/lib/utility/imap-config";

export type ContactEmailCredentials = {
  email: string;
  password: string | null;
  imapHost: string | null;
  imapPort: number;
};

type CredentialsRow = {
  email: string;
  email_password: string;
  imap_host: string;
};

function getEnvEmailPassword(): string | null {
  const password = process.env.CONTACT_EMAIL_PASSWORD?.trim();
  return password || null;
}

function getImapPort(): number {
  const raw = process.env.CONTACT_IMAP_PORT?.trim();
  const parsed = raw ? Number(raw) : 993;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 993;
}

export function resolveImapHost(settingsHost: string): string | null {
  const fromSettings = settingsHost.trim();
  if (fromSettings) {
    return fromSettings;
  }

  return getContactImapHostFromEnv();
}

export async function loadContactEmailCredentials(): Promise<ContactEmailCredentials> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase nav konfigurēts.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contact_settings")
    .select("email, email_password, imap_host")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as CredentialsRow | null;
  if (!row) {
    throw new Error("Kontaktu iestatījumi nav atrasti.");
  }

  const dbPassword = row.email_password?.trim() || null;
  const password = dbPassword || getEnvEmailPassword();

  return {
    email: row.email.trim(),
    password,
    imapHost: resolveImapHost(row.imap_host ?? ""),
    imapPort: getImapPort(),
  };
}

export function hasStoredOrEnvEmailPassword(dbPassword: string | undefined | null): boolean {
  return Boolean(dbPassword?.trim()) || Boolean(getEnvEmailPassword());
}

export { deriveImapHostFromSmtpHost };
