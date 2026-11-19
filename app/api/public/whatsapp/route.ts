import { NextRequest } from "next/server";
import { verifyLookupSubmissionToken } from "@/app/lib/security/lookup-token";
import { publicSubmissionSchema } from "@/app/lib/utility/schemas";
import { validatePublicSubmissionInDb } from "@/app/lib/utility/repository";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/app/lib/security/rate-limit";
import { writeSystemAuditLog } from "@/app/lib/security/audit-log";
import {
  loadWhatsappApiSettings,
  sendWhatsappReadingMessage,
} from "@/app/lib/utility/whatsapp-notify";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  if (!checkRateLimit(`public-whatsapp:${ip}`, 10, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const body = publicSubmissionSchema.parse(await request.json());

    if (!verifyLookupSubmissionToken(body.clientId, body.submissionToken)) {
      return Response.json(
        {
          success: false,
          message: "Nederīgs vai novecojis iesniegšanas tokens. Meklējiet klientu vēlreiz.",
        },
        { status: 403 },
      );
    }

    const validation = await validatePublicSubmissionInDb(body.clientId, body.readings);
    if (!validation.ok) {
      return Response.json(
        { success: false, message: validation.message },
        { status: validation.status },
      );
    }

    const settings = await loadWhatsappApiSettings();
    if (settings.mode !== "api") {
      return Response.json(
        { success: false, message: "WhatsApp sūtīšana caur API nav ieslēgta." },
        { status: 400 },
      );
    }

    const submittedMeters = validation.meters.filter(
      (meter) => validation.readings[meter.id] !== undefined,
    );
    const result = await sendWhatsappReadingMessage(settings, {
      clientNumber: validation.client.clientNumber,
      address: validation.client.address,
      month: validation.month,
      readings: submittedMeters.map((meter) => ({
        meterNumber: meter.number,
        type: meter.type,
        value: validation.readings[meter.id] ?? 0,
      })),
    });

    await writeSystemAuditLog({
      action: result.ok ? "public_whatsapp_sent" : "public_whatsapp_failed",
      entityType: "readings_submission",
      entityId: `${body.clientId}:${validation.month}`,
      details: {
        clientId: body.clientId,
        month: validation.month,
        meterCount: submittedMeters.length,
        source: "public_web_whatsapp",
      },
    });

    if (!result.ok) {
      return Response.json({ success: false, message: result.message }, { status: 502 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās nosūtīt WhatsApp ziņu.",
      },
      { status: 400 },
    );
  }
}
