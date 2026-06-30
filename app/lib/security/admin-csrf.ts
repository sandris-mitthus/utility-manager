import { createHmac, timingSafeEqual } from "crypto";
import type { AdminUser } from "@/app/lib/auth/admin-types";
import { ADMIN_MUTATION_HEADER } from "@/app/lib/security/admin-api";

const ADMIN_CSRF_TTL_MS = 8 * 60 * 60 * 1000;

function getCsrfSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY nav konfigurēts.");
  }
  return secret;
}

function adminCsrfSubject(admin: AdminUser): string {
  return `${admin.id}:${admin.authUserId ?? ""}:${admin.email}`;
}

function signAdminCsrf(admin: AdminUser, expiresAt: number): string {
  return createHmac("sha256", getCsrfSecret())
    .update(`${adminCsrfSubject(admin)}:${expiresAt}`)
    .digest("base64url");
}

export function createAdminCsrfToken(admin: AdminUser, issuedAt = Date.now()): string {
  const expiresAt = issuedAt + ADMIN_CSRF_TTL_MS;
  return `${expiresAt}.${signAdminCsrf(admin, expiresAt)}`;
}

export function verifyAdminCsrfToken(admin: AdminUser, token: string): boolean {
  const [expiresAtRaw, signature] = token.split(".");
  if (!expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const expected = signAdminCsrf(admin, expiresAt);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function requireAdminMutation(request: Request, admin: AdminUser): Response | null {
  const token = request.headers.get(ADMIN_MUTATION_HEADER) ?? "";
  if (!verifyAdminCsrfToken(admin, token)) {
    return Response.json(
      { success: false, message: "Nederīgs vai novecojis drošības tokens." },
      { status: 403 },
    );
  }

  return null;
}
