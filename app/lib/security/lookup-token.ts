import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function getSigningSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY nav konfigurēts.");
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

export function createLookupSubmissionToken(clientId: string, issuedAt = Date.now()): string {
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const payload = `${clientId}:${expiresAt}`;
  return `${expiresAt}.${signPayload(payload)}`;
}

export function verifyLookupSubmissionToken(clientId: string, token: string): boolean {
  const [expiresAtRaw, signature] = token.split(".");
  if (!expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const expected = signPayload(`${clientId}:${expiresAt}`);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
