import { NextRequest } from "next/server";
import { requireAdminRead } from "@/app/lib/auth/require-admin-mutation";
import { loadUtilityAdminState } from "@/app/lib/utility/repository";
import { getCurrentMonthKey } from "@/app/lib/utility/helpers";

function getRequestedMonth(request: NextRequest): string {
  const month = request.nextUrl.searchParams.get("month")?.trim();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return month;
  }
  return getCurrentMonthKey();
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const state = await loadUtilityAdminState(getRequestedMonth(request));
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
