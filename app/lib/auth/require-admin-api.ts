import { getAdminAccess } from "@/app/lib/auth/get-admin-access";
import type { AdminUser } from "@/app/lib/auth/admin-types";

type AdminApiDenied = {
  ok: false;
  response: Response;
};

type AdminApiAllowed = {
  ok: true;
  admin: AdminUser;
};

export async function requireAdminApi(): Promise<AdminApiDenied | AdminApiAllowed> {
  const access = await getAdminAccess();

  if (access.status === "unauthenticated") {
    return {
      ok: false,
      response: Response.json(
        { success: false, message: "Nepieciešama administratora pieslēgšanās." },
        { status: 401 },
      ),
    };
  }

  if (access.status === "forbidden") {
    return {
      ok: false,
      response: Response.json(
        { success: false, message: "Nav administratora tiesību." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, admin: access.admin };
}
