import { NextRequest } from "next/server";
import { requireAdminApi } from "@/app/lib/auth/require-admin-api";
import type { DemoMeter } from "@/app/lib/demo/types";
import { deleteMeterById, loadUtilityAdminState, upsertMeter } from "@/app/lib/utility/repository";

export async function GET() {
  const auth = await requireAdminApi();
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
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as DemoMeter;
    const saved = await upsertMeter(body);
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, data: saved, state });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās saglabāt skaitītāju.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const meterId = request.nextUrl.searchParams.get("id");
  if (!meterId) {
    return Response.json({ success: false, message: "Trūkst skaitītāja id." }, { status: 400 });
  }

  try {
    await deleteMeterById(meterId);
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, state });
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
