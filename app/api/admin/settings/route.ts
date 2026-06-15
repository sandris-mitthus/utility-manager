import { NextRequest } from "next/server";
import { requireAdminApi } from "@/app/lib/auth/require-admin-api";
import type { DemoContactSettings } from "@/app/lib/demo/types";
import { updateContactSettings } from "@/app/lib/utility/repository";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { loadUtilityAdminState } = await import("@/app/lib/utility/repository");
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
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as DemoContactSettings;
    const settings = await updateContactSettings({
      email: body.email ?? "",
      emailPassword: body.emailPassword ?? "",
      smsNumber: body.smsNumber ?? "",
      whatsappNumber: body.whatsappNumber ?? "",
      phoneNumber: body.phoneNumber ?? "",
    });

    return Response.json({ success: true, data: settings });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās saglabāt iestatījumus.",
      },
      { status: 500 },
    );
  }
}
