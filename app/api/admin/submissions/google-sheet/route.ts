import { NextRequest } from "next/server";
import { requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { syncGoogleSheetMonthInDb } from "@/app/lib/utility/repository";
import { googleSheetMonthSyncSchema } from "@/app/lib/utility/schemas";

export async function POST(request: NextRequest) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = googleSheetMonthSyncSchema.parse(await request.json());
    const summary = await syncGoogleSheetMonthInDb(body.month);

    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "sync_google_sheet",
      entityType: "readings_submissions",
      entityId: body.month,
      details: summary,
    });

    return Response.json({ success: true, data: summary });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās atjaunot Google Sheet.",
      },
      { status: 400 },
    );
  }
}
