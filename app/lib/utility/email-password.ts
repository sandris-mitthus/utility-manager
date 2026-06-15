export function isContactEmailPasswordConfigured(): boolean {
  return Boolean(process.env.CONTACT_EMAIL_PASSWORD?.trim());
}

export function isContactEmailTransportConfigured(): boolean {
  return Boolean(process.env.CONTACT_SMTP_HOST?.trim()) && isContactEmailPasswordConfigured();
}