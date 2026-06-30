import { NextRequest } from "next/server";
import { requireAdminRead, requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { utilityClientSchema, deleteIdQuerySchema } from "@/app/lib/utility/schemas";
import { deleteClientById, loadUtilityAdminState, upsertClient } from "@/app/lib/utility/repository";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, data: state.clients });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ielādēt klientus.",
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
    const body = utilityClientSchema.parse(await request.json());
    const saved = await upsertClient(body);
    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "upsert",
      entityType: "client",
      entityId: saved.id,
    });
    return Response.json({ success: true, data: saved });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās saglabāt klientu.",
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
    return Response.json({ success: false, message: "Trūkst derīga klienta id." }, { status: 400 });
  }

  try {
    await deleteClientById(parsed.data.id);
    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "delete",
      entityType: "client",
      entityId: parsed.data.id,
    });
    return Response.json({ success: true, data: { id: parsed.data.id } });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās dzēst klientu.",
      },
      { status: 500 },
    );
  }
}
