import { requireAdminApi } from "@/app/lib/auth/require-admin-api";
import { loadUtilityAdminState } from "@/app/lib/utility/repository";

export async function GET() {
  const auth = await requireAdminApi();
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
