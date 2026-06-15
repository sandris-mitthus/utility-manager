import { requireAdminApi } from "@/app/lib/auth/require-admin-api";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/app/lib/security/rate-limit";
import { requireAdminMutation } from "@/app/lib/security/admin-api";
import type { AdminUser } from "@/app/lib/auth/admin-types";

type Denied = { ok: false; response: Response };
type Allowed = { ok: true; admin: AdminUser };

export async function requireAdminRead(request: Request): Promise<Denied | Allowed> {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth;
  }

  const ip = getRequestIp(request);
  if (!checkRateLimit(`admin-read:${auth.admin.email}:${ip}`, 240, 60_000)) {
    return { ok: false, response: rateLimitResponse() };
  }

  return auth;
}

export async function requireAdminWrite(request: Request): Promise<Denied | Allowed> {
  const mutationDenied = requireAdminMutation(request);
  if (mutationDenied) {
    return { ok: false, response: mutationDenied };
  }

  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth;
  }

  const ip = getRequestIp(request);
  if (!checkRateLimit(`admin-write:${auth.admin.email}:${ip}`, 120, 60_000)) {
    return { ok: false, response: rateLimitResponse() };
  }

  return auth;
}
