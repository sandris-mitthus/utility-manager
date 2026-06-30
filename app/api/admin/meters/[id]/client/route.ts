import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { attachMeterClientSchema } from "@/app/lib/utility/schemas";
import { attachMeterToClientInDb } from "@/app/lib/utility/repository";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const meterId = z.string().uuid().parse(id);

  try {
    const body = attachMeterClientSchema.parse(await request.json());
    await attachMeterToClientInDb(meterId, body.clientId ?? null);
    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "attach_client",
      entityType: "meter",
      entityId: meterId,
      details: { clientId: body.clientId },
    });
    return Response.json({
      success: true,
      data: { meterId, clientId: body.clientId ?? null },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās piesaistīt adresi.",
      },
      { status: 400 },
    );
  }
}
