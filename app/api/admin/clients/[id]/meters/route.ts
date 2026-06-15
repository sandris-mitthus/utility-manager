import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { syncClientMetersSchema } from "@/app/lib/utility/schemas";
import { loadUtilityAdminState, syncClientMetersInDb } from "@/app/lib/utility/repository";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const clientId = z.string().uuid().parse(id);

  try {
    const body = syncClientMetersSchema.parse(await request.json());
    await syncClientMetersInDb(clientId, body.meterIds);
    const state = await loadUtilityAdminState();
    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "sync_meters",
      entityType: "client",
      entityId: clientId,
      details: { meterIds: body.meterIds },
    });
    return Response.json({ success: true, state });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās piesaistīt skaitītājus.",
      },
      { status: 400 },
    );
  }
}
