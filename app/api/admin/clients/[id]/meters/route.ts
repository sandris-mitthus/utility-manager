import { NextRequest } from "next/server";
import { requireAdminApi } from "@/app/lib/auth/require-admin-api";
import { loadUtilityAdminState, syncClientMetersInDb } from "@/app/lib/utility/repository";

type SyncMetersBody = {
  meterIds: string[];
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as SyncMetersBody;
    await syncClientMetersInDb(id, body.meterIds ?? []);
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, state });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās piesaistīt skaitītājus.",
      },
      { status: 500 },
    );
  }
}
