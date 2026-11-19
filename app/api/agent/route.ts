import { after, NextRequest } from "next/server";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/app/lib/security/rate-limit";
import { writeSystemAuditLog } from "@/app/lib/security/audit-log";
import { sendSubmissionNotificationEmail } from "@/app/lib/utility/contact-email";
import { sendSubmissionNotificationWhatsapp } from "@/app/lib/utility/whatsapp-notify";
import { loadPublicContactSettings } from "@/app/lib/utility/repository";
import {
  findClientForAgent,
  isVoiceAgentKey,
  submitReadingForAgent,
  VOICE_AGENT_TOOLSET,
} from "@/app/lib/utility/voice-agent";

export const runtime = "nodejs";

function deny() {
  return Response.json({ success: false, message: "Nav piekļuves." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!checkRateLimit(`voice-agent:${getRequestIp(request)}`, 120, 60_000)) {
    return rateLimitResponse();
  }
  if (!(await isVoiceAgentKey(request.headers.get("authorization")))) {
    return deny();
  }
  return Response.json(VOICE_AGENT_TOOLSET);
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`voice-agent:${getRequestIp(request)}`, 120, 60_000)) {
    return rateLimitResponse();
  }
  if (!(await isVoiceAgentKey(request.headers.get("authorization")))) {
    return deny();
  }

  const body = (await request.json().catch(() => null)) as {
    tool?: string;
    args?: Record<string, unknown>;
    caller?: string;
  } | null;
  const args = body?.args ?? {};
  const clientNumber = String(args.client_number ?? "").trim().slice(0, 40);

  try {
    if (body?.tool === "find_client") {
      return Response.json(await findClientForAgent(clientNumber));
    }

    if (body?.tool === "submit_reading") {
      const reading = Number(String(args.reading ?? "").replace(/\s+/g, "").replace(",", "."));
      const result = await submitReadingForAgent(clientNumber, String(args.meter ?? "").slice(0, 40), reading);
      if (!result.ok) {
        return Response.json({ ok: false, message: result.message });
      }

      after(async () => {
        await writeSystemAuditLog({
          action: "public_submission_created",
          entityType: "readings_submission",
          entityId: `${result.client.id}:${result.month}`,
          details: {
            clientId: result.client.id,
            month: result.month,
            meterCount: 1,
            source: "phone_agent",
            caller: String(body.caller ?? "").slice(0, 40),
          },
        });

        try {
          const settings = await loadPublicContactSettings();
          await sendSubmissionNotificationEmail({
            to: settings.email,
            clientNumber: result.client.clientNumber,
            address: result.client.address,
            month: result.month,
            readings: { [result.meter.id]: { meterNumber: result.meter.number, value: result.reading } },
          });
        } catch (emailError) {
          console.error("Submission notification email failed:", emailError);
        }

        try {
          const sent = await sendSubmissionNotificationWhatsapp({
            clientNumber: result.client.clientNumber,
            address: result.client.address,
            month: result.month,
            readings: [{ meterNumber: result.meter.number, type: result.meter.type, value: result.reading }],
          });
          if (!sent.ok) {
            console.error("Submission notification WhatsApp failed:", sent.message);
          }
        } catch (whatsappError) {
          console.error("Submission notification WhatsApp failed:", whatsappError);
        }
      });

      return Response.json({ ok: true, message: result.message });
    }

    return Response.json({ success: false, message: "Nezināma darbība." }, { status: 400 });
  } catch (error) {
    return Response.json({
      ok: false,
      message: error instanceof Error ? error.message : "Neizdevās saglabāt rādījumu.",
    });
  }
}
