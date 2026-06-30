import { NextRequest } from "next/server";
import { verifyLookupSubmissionToken } from "@/app/lib/security/lookup-token";
import { publicSubmissionSchema } from "@/app/lib/utility/schemas";
import { sendSubmissionNotificationEmail } from "@/app/lib/utility/contact-email";
import { loadPublicContactSettings, submitReadingsInDb, validatePublicSubmissionInDb } from "@/app/lib/utility/repository";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/app/lib/security/rate-limit";
import { writeSystemAuditLog } from "@/app/lib/security/audit-log";

function getPublicSubmissionErrorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  if (error.message.includes("Google Sheets autorizācija")) {
    return "google_oauth_invalid";
  }

  if (error.message.includes("Google Sheets nav konfigurēts")) {
    return "google_sheets_not_configured";
  }

  return "public_submission_sync_failed";
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  if (!checkRateLimit(`public-submission:${ip}`, 20, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const body = publicSubmissionSchema.parse(await request.json());

    if (!verifyLookupSubmissionToken(body.clientId, body.submissionToken)) {
      return Response.json(
        { success: false, message: "Nederīgs vai novecojis iesniegšanas tokens. Meklējiet klientu vēlreiz." },
        { status: 403 },
      );
    }

    const validation = await validatePublicSubmissionInDb(body.clientId, body.readings);
    if (!validation.ok) {
      return Response.json({ success: false, message: validation.message }, { status: validation.status });
    }

    try {
      await submitReadingsInDb(
        body.clientId,
        validation.month,
        body.readings,
        Object.fromEntries(validation.meters.map((meter) => [meter.id, meter.previousReading])),
        {
          client: validation.client,
          meters: validation.meters,
        },
        true,
      );

      await writeSystemAuditLog({
        action: "public_submission_created",
        entityType: "readings_submission",
        entityId: `${body.clientId}:${validation.month}`,
        details: {
          clientId: body.clientId,
          month: validation.month,
          meterCount: validation.meters.length,
          source: "public_web",
          googleSheetSync: "required_success",
        },
      });
    } catch (submitError) {
      await writeSystemAuditLog({
        action: "public_submission_failed",
        entityType: "readings_submission",
        entityId: `${body.clientId}:${validation.month}`,
        details: {
          clientId: body.clientId,
          month: validation.month,
          meterCount: validation.meters.length,
          source: "public_web",
          stage: "required_google_sheet_sync_or_db_write",
          errorCode: getPublicSubmissionErrorCode(submitError),
        },
      });
      throw submitError;
    }

    try {
      const settings = await loadPublicContactSettings();
      await sendSubmissionNotificationEmail({
        to: settings.email,
        clientNumber: validation.client.clientNumber,
        address: validation.client.address,
        month: validation.month,
        readings: Object.fromEntries(
          validation.meters.map((meter) => [
            meter.id,
            { meterNumber: meter.number, value: body.readings[meter.id] ?? 0 },
          ]),
        ),
      });
    } catch (emailError) {
      console.error("Submission notification email failed:", emailError);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās iesniegt rādījumus.",
      },
      { status: 400 },
    );
  }
}
