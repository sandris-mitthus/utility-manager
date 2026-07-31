const DEFAULT_GRAPH_API_VERSION = "v21.0";

export function getWhatsappGraphApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
}

export function getEnvWhatsappAccessToken(): string | null {
  return process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
}

export function getEnvWhatsappPhoneNumberId(): string | null {
  return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
}

export function hasStoredOrEnvWhatsappAccessToken(
  storedToken: string | undefined | null,
): boolean {
  return Boolean(storedToken?.trim()) || Boolean(getEnvWhatsappAccessToken());
}

export function resolveWhatsappPhoneNumberId(storedPhoneNumberId: string): string | null {
  return storedPhoneNumberId.trim() || getEnvWhatsappPhoneNumberId();
}

/** API režīmam vajag sūtītāja phone number ID, piekļuves tokenu un saņēmēja numuru. */
export function isWhatsappApiConfigured(
  phoneNumberId: string,
  notifyNumber: string,
  storedToken: string | undefined | null,
): boolean {
  return (
    Boolean(resolveWhatsappPhoneNumberId(phoneNumberId)) &&
    Boolean(notifyNumber.trim()) &&
    hasStoredOrEnvWhatsappAccessToken(storedToken)
  );
}
