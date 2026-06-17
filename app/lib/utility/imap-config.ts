import { hasStoredOrEnvEmailPassword } from "@/app/lib/utility/contact-settings-credentials";

function deriveImapHostFromSmtp(smtpHost: string): string | null {
  const trimmed = smtpHost.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("smtp.")) {
    return `imap.${trimmed.slice(5)}`;
  }

  if (trimmed.startsWith("mail.")) {
    return trimmed;
  }

  return `imap.${trimmed}`;
}

export function getContactImapHostFromEnv(): string | null {
  const explicit = process.env.CONTACT_IMAP_HOST?.trim();
  if (explicit) {
    return explicit;
  }

  const smtpHost = process.env.CONTACT_SMTP_HOST?.trim();
  if (!smtpHost) {
    return null;
  }

  return deriveImapHostFromSmtp(smtpHost);
}

export function deriveImapHostFromSmtpHost(smtpHost: string): string | null {
  return deriveImapHostFromSmtp(smtpHost);
}

export function getContactImapPort(): number {
  const raw = process.env.CONTACT_IMAP_PORT?.trim();
  const parsed = raw ? Number(raw) : 993;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 993;
}

export function getContactImapUser(fallbackEmail: string): string {
  return process.env.CONTACT_IMAP_USER?.trim() || process.env.CONTACT_SMTP_USER?.trim() || fallbackEmail;
}

export function isEnvContactEmailPasswordConfigured(): boolean {
  return Boolean(process.env.CONTACT_EMAIL_PASSWORD?.trim());
}

export function isContactEmailTransportConfigured(): boolean {
  return Boolean(process.env.CONTACT_SMTP_HOST?.trim()) && isEnvContactEmailPasswordConfigured();
}

export function isContactImapConfiguredFromEnv(): boolean {
  return Boolean(getContactImapHostFromEnv()) && isEnvContactEmailPasswordConfigured();
}

export function isContactInboxConfigured(
  email: string,
  imapHost: string,
  dbPassword: string | undefined | null,
): boolean {
  const hasHost = Boolean(imapHost.trim()) || Boolean(getContactImapHostFromEnv());
  return Boolean(email.trim()) && hasHost && hasStoredOrEnvEmailPassword(dbPassword);
}
