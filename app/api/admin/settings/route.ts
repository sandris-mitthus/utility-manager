import { NextRequest } from "next/server";
import { requireAdminRead, requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { contactSettingsSchema } from "@/app/lib/utility/schemas";
import { loadUtilityAdminState, updateContactSettings } from "@/app/lib/utility/repository";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, data: state.settings });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ielādēt iestatījumus.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = contactSettingsSchema.parse(await request.json());
    const settings = await updateContactSettings(body);
    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "update",
      entityType: "contact_settings",
      entityId: "1",
    });
    return Response.json({ success: true, data: settings });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās saglabāt iestatījumus.",
      },
      { status: 400 },
    );
  }
}
