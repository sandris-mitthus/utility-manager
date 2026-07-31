import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import {
  getEnvWhatsappAccessToken,
  getWhatsappGraphApiVersion,
  resolveWhatsappPhoneNumberId,
} from "@/app/lib/utility/whatsapp-config";
import {
  buildWhatsappReadingMessage,
  normalizeWhatsappNumber,
  toWhatsappTemplateParameter,
  type WhatsappMessageInput,
} from "@/app/lib/utility/whatsapp-message";
import type { WhatsappMode } from "@/app/lib/utility/types";

export type WhatsappApiSettings = {
  mode: WhatsappMode;
  phoneNumberId: string | null;
  accessToken: string | null;
  notifyNumber: string;
  templateName: string;
  templateLanguage: string;
  messageTemplate: string;
};

export type WhatsappSendResult = { ok: true } | { ok: false; message: string };

type WhatsappSettingsRow = {
  whatsapp_mode: string;
  whatsapp_phone_number_id: string;
  whatsapp_access_token: string;
  whatsapp_notify_number: string;
  whatsapp_template_name: string;
  whatsapp_template_language: string;
  whatsapp_message_template: string;
};

function normalizeMode(value: string | undefined): WhatsappMode {
  return value === "link" || value === "api" ? value : "off";
}

export async function loadWhatsappApiSettings(): Promise<WhatsappApiSettings> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase nav konfigurēts.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contact_settings")
    .select(
      "whatsapp_mode, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_notify_number, whatsapp_template_name, whatsapp_template_language, whatsapp_message_template",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as WhatsappSettingsRow | null;
  if (!row) {
    throw new Error("Kontaktu iestatījumi nav atrasti.");
  }

  return {
    mode: normalizeMode(row.whatsapp_mode),
    phoneNumberId: resolveWhatsappPhoneNumberId(row.whatsapp_phone_number_id ?? ""),
    accessToken: row.whatsapp_access_token?.trim() || getEnvWhatsappAccessToken(),
    notifyNumber: row.whatsapp_notify_number?.trim() ?? "",
    templateName: row.whatsapp_template_name?.trim() ?? "",
    templateLanguage: row.whatsapp_template_language?.trim() || "lv",
    messageTemplate: row.whatsapp_message_template?.trim() ?? "",
  };
}

function buildGraphPayload(settings: WhatsappApiSettings, to: string, body: string) {
  if (settings.templateName) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: settings.templateName,
        language: { code: settings.templateLanguage },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: toWhatsappTemplateParameter(body) }],
          },
        ],
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { preview_url: false, body },
  };
}

function readGraphErrorMessage(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: { message?: string; error_user_msg?: string } }).error;
    return error?.error_user_msg || error?.message || "WhatsApp API atteica pieprasījumu.";
  }

  return "WhatsApp API atteica pieprasījumu.";
}

export async function sendWhatsappMessage(
  settings: WhatsappApiSettings,
  input: { to: string; body: string },
): Promise<WhatsappSendResult> {
  if (!settings.phoneNumberId) {
    return { ok: false, message: "Nav norādīts WhatsApp sūtītāja numura ID." };
  }

  if (!settings.accessToken) {
    return { ok: false, message: "Nav norādīts WhatsApp piekļuves tokens." };
  }

  const to = normalizeWhatsappNumber(input.to);
  if (!to) {
    return { ok: false, message: "Nav norādīts derīgs WhatsApp saņēmēja numurs." };
  }

  const url = `https://graph.facebook.com/${getWhatsappGraphApiVersion()}/${settings.phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGraphPayload(settings, to, input.body)),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return { ok: false, message: readGraphErrorMessage(payload) };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Neizdevās sasniegt WhatsApp API.",
    };
  }
}

export async function sendWhatsappReadingMessage(
  settings: WhatsappApiSettings,
  input: WhatsappMessageInput,
  to = settings.notifyNumber,
): Promise<WhatsappSendResult> {
  return sendWhatsappMessage(settings, {
    to,
    body: buildWhatsappReadingMessage(settings.messageTemplate, input),
  });
}

/** Paziņojums pēc web iesniegšanas — klusi izlaiž, ja API režīms nav konfigurēts. */
export async function sendSubmissionNotificationWhatsapp(
  input: WhatsappMessageInput,
): Promise<WhatsappSendResult> {
  const settings = await loadWhatsappApiSettings();
  if (settings.mode !== "api") {
    return { ok: true };
  }

  if (!settings.notifyNumber) {
    return { ok: false, message: "Nav norādīts WhatsApp paziņojumu numurs." };
  }

  return sendWhatsappReadingMessage(settings, input);
}
