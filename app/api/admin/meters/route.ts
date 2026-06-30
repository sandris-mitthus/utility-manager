import { NextRequest } from "next/server";
import { requireAdminRead, requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import {
  deleteIdQuerySchema,
  utilityMeterSchema,
} from "@/app/lib/utility/schemas";
import { deleteMeterById, loadUtilityAdminState, upsertMeter } from "@/app/lib/utility/repository";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, data: state.meters });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ielādēt skaitītājus.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = utilityMeterSchema.parse(await request.json());
    const saved = await upsertMeter(body);
    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "upsert",
      entityType: "meter",
      entityId: saved.id,
    });
    return Response.json({ success: true, data: saved });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās saglabāt skaitītāju.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = deleteIdQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });

  if (!parsed.success) {
    return Response.json({ success: false, message: "Trūkst derīga skaitītāja id." }, { status: 400 });
  }

  try {
    await deleteMeterById(parsed.data.id);
    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "delete",
      entityType: "meter",
      entityId: parsed.data.id,
    });
    return Response.json({ success: true, data: { id: parsed.data.id } });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās dzēst skaitītāju.",
      },
      { status: 500 },
    );
  }
}
