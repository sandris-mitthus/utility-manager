import { createHmac, timingSafeEqual } from "node:crypto";

export function getWhatsappWebhookVerifyToken(): string | null {
  return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || null;
}

export function getWhatsappAppSecret(): string | null {
  return process.env.WHATSAPP_APP_SECRET?.trim() || null;
}

export function isWhatsappWebhookConfigured(): boolean {
  return Boolean(getWhatsappWebhookVerifyToken()) && Boolean(getWhatsappAppSecret());
}

export function verifyWhatsappWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

export type IncomingWhatsappTextMessage = {
  waMessageId: string;
  fromWaId: string;
  fromProfileName: string;
  bodyText: string;
  receivedAt: string | null;
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

/** Extract inbound text messages from a Meta Cloud API webhook payload. */
export function extractWhatsappTextMessages(payload: unknown): IncomingWhatsappTextMessage[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = payload as MetaWebhookPayload;
  if (data.object !== "whatsapp_business_account" || !Array.isArray(data.entry)) {
    return [];
  }

  const results: IncomingWhatsappTextMessage[] = [];

  for (const entry of data.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== "messages") {
        continue;
      }

      const value = change.value;
      if (!value?.messages?.length) {
        continue;
      }

      const nameByWaId = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        const waId = contact.wa_id?.trim();
        const name = contact.profile?.name?.trim();
        if (waId && name) {
          nameByWaId.set(waId, name);
        }
      }

      for (const message of value.messages) {
        if (message.type !== "text") {
          continue;
        }

        const waMessageId = message.id?.trim();
        const fromWaId = message.from?.trim();
        const bodyText = message.text?.body?.trim() ?? "";

        if (!waMessageId || !fromWaId || !bodyText) {
          continue;
        }

        const timestampSec = Number(message.timestamp);
        const receivedAt =
          Number.isFinite(timestampSec) && timestampSec > 0
            ? new Date(timestampSec * 1000).toISOString()
            : null;

        results.push({
          waMessageId,
          fromWaId,
          fromProfileName: nameByWaId.get(fromWaId) ?? "",
          bodyText,
          receivedAt,
        });
      }
    }
  }

  return results;
}
