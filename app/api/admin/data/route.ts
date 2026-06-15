import { NextRequest } from "next/server";
import { requireAdminRead } from "@/app/lib/auth/require-admin-mutation";
import { loadUtilityAdminState } from "@/app/lib/utility/repository";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const state = await loadUtilityAdminState();
    return Response.json({ success: true, data: state });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ielādēt datus.",
      },
      { status: 500 },
    );
  }
}
