import { NextRequest } from "next/server";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/app/lib/security/rate-limit";
import { writeSystemAuditLog } from "@/app/lib/security/audit-log";
import { importPendingWhatsappInboxSubmissions } from "@/app/lib/utility/import-whatsapp-inbox-submissions";
import { loadUtilityAdminState } from "@/app/lib/utility/repository";
import { insertWhatsappInboxMessage } from "@/app/lib/utility/whatsapp-inbox-repository";
import {
  extractWhatsappTextMessages,
  getWhatsappAppSecret,
  getWhatsappWebhookVerifyToken,
  verifyWhatsappWebhookSignature,
} from "@/app/lib/utility/whatsapp-webhook";

export const runtime = "nodejs";

/** Meta webhook verification (hub.challenge). */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const expected = getWhatsappWebhookVerifyToken();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return Response.json({ success: false, message: "Webhook verification failed." }, { status: 403 });
}

/** Inbound WhatsApp messages from Meta Cloud API. */
export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  if (!checkRateLimit(`whatsapp-webhook:${ip}`, 120, 60_000)) {
    return rateLimitResponse();
  }

  const appSecret = getWhatsappAppSecret();
  if (!appSecret) {
    return Response.json(
      { success: false, message: "WhatsApp webhook nav konfigurēts (WHATSAPP_APP_SECRET)." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsappWebhookSignature(rawBody, signature, appSecret)) {
    return Response.json({ success: false, message: "Nederīgs webhook paraksts." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json({ success: false, message: "Nederīgs JSON." }, { status: 400 });
  }

  const incoming = extractWhatsappTextMessages(payload);
  if (incoming.length === 0) {
    // Status updates / non-text — acknowledge without error
    return Response.json({ success: true, data: { inserted: 0 } });
  }

  try {
    const insertedMessages = [];

    for (const message of incoming) {
      const result = await insertWhatsappInboxMessage({
        waMessageId: message.waMessageId,
        fromWaId: message.fromWaId,
        fromProfileName: message.fromProfileName,
        bodyText: message.bodyText,
        receivedAt: message.receivedAt,
      });

      if (result.inserted && result.message) {
        insertedMessages.push(result.message);
      }
    }

    let importSummary = { imported: 0, skipped: 0, failed: 0 };
    if (insertedMessages.length > 0) {
      const state = await loadUtilityAdminState();
      importSummary = await importPendingWhatsappInboxSubmissions(
        insertedMessages,
        state.clients,
        state.meters,
        insertedMessages.length,
      );
    }

    await writeSystemAuditLog({
      action: "whatsapp_webhook_received",
      entityType: "whatsapp_inbox",
      entityId: "webhook",
      details: {
        received: incoming.length,
        inserted: insertedMessages.length,
        importSummary,
      },
    });

    return Response.json({
      success: true,
      data: {
        received: incoming.length,
        inserted: insertedMessages.length,
        importSummary,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās apstrādāt WhatsApp ziņu.",
      },
      { status: 500 },
    );
  }
}
