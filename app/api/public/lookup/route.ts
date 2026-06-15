import { NextRequest } from "next/server";
import { publicLookupQuerySchema } from "@/app/lib/utility/schemas";
import { lookupPublicClientInDb } from "@/app/lib/utility/repository";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/app/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getRequestIp(request);
  if (!checkRateLimit(`public-lookup:${ip}`, 30, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const { q } = publicLookupQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? "",
    });

    const result = await lookupPublicClientInDb(q);
    if (!result) {
      return Response.json({ success: false, message: "Klients nav atrasts." }, { status: 404 });
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās meklēt klientu.",
      },
      { status: 400 },
    );
  }
}
