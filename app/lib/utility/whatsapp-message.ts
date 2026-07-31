import { METER_TYPE_LABELS } from "@/app/lib/utility/helpers";
import type { MeterType, WhatsappMode } from "@/app/lib/utility/types";

export const WHATSAPP_MESSAGE_TEMPLATE = `Skaitītāju rādījumi
Klienta numurs: {client_number}
Adrese: {address}
Mēnesis: {month}
{readings}`;

export const WHATSAPP_MODE_LABELS: Record<WhatsappMode, string> = {
  off: "Izslēgts",
  link: "WhatsApp saite uz numuru",
  api: "WhatsApp Business API",
};

export type WhatsappReadingLine = {
  meterNumber: string;
  type: MeterType;
  value: number;
};

export type WhatsappMessageInput = {
  clientNumber: string;
  address: string;
  month: string;
  readings: WhatsappReadingLine[];
};

function formatReadingLines(readings: WhatsappReadingLine[]): string {
  return readings
    .map((reading) => `${METER_TYPE_LABELS[reading.type]} (${reading.meterNumber}): ${reading.value}`)
    .join("\n");
}

export function buildWhatsappReadingMessage(
  template: string,
  input: WhatsappMessageInput,
): string {
  const source = template.trim() || WHATSAPP_MESSAGE_TEMPLATE;

  return source
    .replaceAll("{client_number}", input.clientNumber)
    .replaceAll("{address}", input.address)
    .replaceAll("{month}", input.month)
    .replaceAll("{readings}", formatReadingLines(input.readings))
    .trim();
}

/** WhatsApp saitei un Cloud API `to` laukam vajag tikai ciparus ar valsts kodu. */
export function normalizeWhatsappNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function buildWhatsappLinkUrl(number: string, message: string): string | null {
  const normalized = normalizeWhatsappNumber(number);
  if (!normalized) {
    return null;
  }

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * WhatsApp veidnes parametros nav atļautas jaunas rindas un vairākas secīgas
 * atstarpes, tāpēc veidnes režīmā ziņa tiek saspiesta vienā rindā.
 */
export function toWhatsappTemplateParameter(message: string): string {
  return message.replace(/\s*\n+\s*/g, "; ").replace(/ {2,}/g, " ").trim();
}
