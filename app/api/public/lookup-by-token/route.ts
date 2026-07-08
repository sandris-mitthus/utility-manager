import { NextRequest } from "next/server";
import { publicLookupTokenQuerySchema } from "@/app/lib/utility/schemas";
import { lookupPublicClientByTokenInDb } from "@/app/lib/utility/repository";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/app/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getRequestIp(request);
  if (!checkRateLimit(`public-lookup-token:${ip}`, 30, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const { token } = publicLookupTokenQuerySchema.parse({
      token: request.nextUrl.searchParams.get("token") ?? "",
    });

    const result = await lookupPublicClientByTokenInDb(token);
    if (!result) {
      return Response.json({ success: false, message: "Saite nav derīga vai klients nav atrasts." }, { status: 404 });
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ielādēt klienta formu.",
      },
      { status: 400 },
    );
  }
}
