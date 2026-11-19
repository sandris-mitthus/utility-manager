import { createAdminClient } from "@/app/lib/supabase/admin";

export const RESEND_INTEGRATION_KEY = "resend";

export type IntegrationPublic = {
  key: string;
  fromEmail: string;
  replyToEmail: string;
  hasSecret: boolean;
  configured: boolean;
  enabled: boolean;
};

type IntegrationRow = {
  integration_key: string;
  client_id: string;
  client_secret: string;
  is_configured: boolean;
  is_enabled: boolean;
  configured_account_email: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toPublic(row: IntegrationRow): IntegrationPublic {
  return {
    key: row.integration_key,
    fromEmail: row.client_id ?? "",
    replyToEmail: row.configured_account_email ?? "",
    hasSecret: Boolean(row.client_secret?.trim()),
    configured: row.is_configured,
    enabled: row.is_enabled,
  };
}

async function loadRow(key: string): Promise<IntegrationRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_integrations")
    .select(
      "integration_key, client_id, client_secret, is_configured, is_enabled, configured_account_email",
    )
    .eq("integration_key", key)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as IntegrationRow | null) ?? null;
}

export async function listIntegrations(): Promise<IntegrationPublic[]> {
  const row = await loadRow(RESEND_INTEGRATION_KEY);
  if (!row) {
    return [
      {
        key: RESEND_INTEGRATION_KEY,
        fromEmail: "",
        replyToEmail: "",
        hasSecret: false,
        configured: false,
        enabled: false,
      },
    ];
  }

  return [toPublic(row)];
}

export async function saveResendIntegration(input: {
  fromEmail: string;
  apiKey: string;
  keepSecret: boolean;
  replyToEmail: string;
}): Promise<IntegrationPublic> {
  const fromEmail = input.fromEmail.trim();
  const replyToEmail = input.replyToEmail.trim();
  const apiKey = input.apiKey.trim();

  if (!isEmail(fromEmail)) {
    throw new Error("Norādiet derīgu sūtītāja e-pastu.");
  }

  if (replyToEmail && !isEmail(replyToEmail)) {
    throw new Error("Norādiet derīgu Reply-To e-pastu.");
  }

  const current = await loadRow(RESEND_INTEGRATION_KEY);
  const secret = input.keepSecret ? (current?.client_secret ?? "") : apiKey;
  if (!secret.trim()) {
    throw new Error("Norādiet Resend API atslēgu.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_integrations")
    .upsert(
      {
        integration_key: RESEND_INTEGRATION_KEY,
        client_id: fromEmail,
        client_secret: secret.trim(),
        configured_account_email: replyToEmail,
        is_configured: true,
        is_enabled: current?.is_enabled ?? false,
      },
      { onConflict: "integration_key" },
    )
    .select(
      "integration_key, client_id, client_secret, is_configured, is_enabled, configured_account_email",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toPublic(data as IntegrationRow);
}

export async function setResendEnabled(enabled: boolean): Promise<IntegrationPublic> {
  const current = await loadRow(RESEND_INTEGRATION_KEY);
  if (enabled && !current?.is_configured) {
    throw new Error("Vispirms saglabājiet sūtītāja e-pastu un API atslēgu.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_integrations")
    .update({ is_enabled: enabled })
    .eq("integration_key", RESEND_INTEGRATION_KEY)
    .select(
      "integration_key, client_id, client_secret, is_configured, is_enabled, configured_account_email",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toPublic(data as IntegrationRow);
}

export async function resetResendIntegration(): Promise<IntegrationPublic> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_integrations")
    .upsert(
      {
        integration_key: RESEND_INTEGRATION_KEY,
        client_id: "",
        client_secret: "",
        configured_account_email: "",
        is_configured: false,
        is_enabled: false,
      },
      { onConflict: "integration_key" },
    )
    .select(
      "integration_key, client_id, client_secret, is_configured, is_enabled, configured_account_email",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toPublic(data as IntegrationRow);
}

export async function getResendCredentials(): Promise<{
  fromEmail: string;
  apiKey: string;
  replyToEmail: string;
} | null> {
  const row = await loadRow(RESEND_INTEGRATION_KEY);
  if (!row?.is_enabled || !row.is_configured) {
    return null;
  }

  const fromEmail = row.client_id.trim();
  const apiKey = row.client_secret.trim();
  if (!fromEmail || !apiKey) {
    return null;
  }

  return {
    fromEmail,
    apiKey,
    replyToEmail: row.configured_account_email.trim(),
  };
}
