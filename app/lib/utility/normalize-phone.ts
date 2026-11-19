/** Digits only — for comparing WhatsApp wa_id with clients.phone. */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Match international vs local forms (e.g. 3712xxxxxxx vs 2xxxxxxx).
 * Requires at least 8 matching trailing digits when lengths differ.
 */
export function phonesMatch(storedPhone: string, senderWaId: string): boolean {
  const stored = normalizePhoneDigits(storedPhone);
  const sender = normalizePhoneDigits(senderWaId);

  if (!stored || !sender) {
    return false;
  }

  if (stored === sender) {
    return true;
  }

  const shorter = stored.length <= sender.length ? stored : sender;
  const longer = stored.length > sender.length ? stored : sender;

  return shorter.length >= 8 && longer.endsWith(shorter);
}
