import { NextRequest } from "next/server";
import { requireAdminApi } from "@/app/lib/auth/require-admin-api";
import type { DemoClient } from "@/app/lib/demo/types";
import { deleteClientById, loadUtilityAdminState, upsertClient } from "@/app/lib/utility/repository";

export async function GET() {
  const auth = await requireAdminApi();
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
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as DemoClient;
    const saved = await upsertClient(body);
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, data: saved, state });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās saglabāt klientu.",
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

  const clientId = request.nextUrl.searchParams.get("id");
  if (!clientId) {
    return Response.json({ success: false, message: "Trūkst klienta id." }, { status: 400 });
  }

  try {
    await deleteClientById(clientId);
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, state });
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
