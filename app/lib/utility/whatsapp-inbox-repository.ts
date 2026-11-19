import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import {
  getParseStatusFromParsed,
  parseMeterEmail,
} from "@/app/lib/utility/parse-meter-email";
import type { ParsedMeterEmail, WhatsappInboxMessage } from "@/app/lib/utility/types";

type InboxRow = {
  id: string;
  wa_message_id: string;
  from_wa_id: string;
  from_profile_name: string;
  body_text: string;
  received_at: string | null;
  parsed: ParsedMeterEmail | string;
  parse_status: WhatsappInboxMessage["parseStatus"];
  fetched_at: string;
  submission_imported_at: string | null;
  submission_month: string | null;
  submission_client_id: string | null;
  submission_import_error: string;
};

const INBOX_SELECT_COLUMNS =
  "id, wa_message_id, from_wa_id, from_profile_name, body_text, received_at, parsed, parse_status, fetched_at, submission_imported_at, submission_month, submission_client_id, submission_import_error";

function requireDb() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase nav konfigurēts.");
  }
}

function safeParseStoredParsed(value: ParsedMeterEmail | string | null | undefined): ParsedMeterEmail {
  const fallback: ParsedMeterEmail = {
    readings: [],
    warnings: [],
    confidence: "low",
  };

  if (!value) {
    return fallback;
  }

  if (typeof value === "object") {
    return {
      ...fallback,
      ...value,
      readings: Array.isArray(value.readings) ? value.readings : [],
      warnings: Array.isArray(value.warnings) ? value.warnings : [],
    };
  }

  try {
    const parsed = JSON.parse(value) as ParsedMeterEmail;
    return {
      ...fallback,
      ...parsed,
      readings: Array.isArray(parsed.readings) ? parsed.readings : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  } catch {
    return fallback;
  }
}

function mapInboxRow(row: InboxRow): WhatsappInboxMessage {
  return {
    id: row.id,
    waMessageId: row.wa_message_id,
    fromWaId: row.from_wa_id ?? "",
    fromProfileName: row.from_profile_name ?? "",
    bodyText: row.body_text ?? "",
    receivedAt: row.received_at,
    parsed: safeParseStoredParsed(row.parsed),
    parseStatus: row.parse_status,
    fetchedAt: row.fetched_at,
    submissionImportedAt: row.submission_imported_at,
    submissionMonth: row.submission_month,
    submissionClientId: row.submission_client_id,
    submissionImportError: row.submission_import_error ?? "",
  };
}

export async function listWhatsappInboxMessages(limit = 50): Promise<WhatsappInboxMessage[]> {
  requireDb();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_inbox_messages")
    .select(INBOX_SELECT_COLUMNS)
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InboxRow[]).map(mapInboxRow);
}

async function updateParsedInboxRow(id: string, bodyText: string): Promise<void> {
  const supabase = createAdminClient();
  const reparsed = parseMeterEmail("", bodyText);
  const parseStatus = getParseStatusFromParsed(reparsed);
  const { error } = await supabase
    .from("whatsapp_inbox_messages")
    .update({ parsed: reparsed, parse_status: parseStatus })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertWhatsappInboxMessage(input: {
  waMessageId: string;
  fromWaId: string;
  fromProfileName: string;
  bodyText: string;
  receivedAt: string | null;
}): Promise<{ inserted: boolean; message: WhatsappInboxMessage | null }> {
  requireDb();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("whatsapp_inbox_messages")
    .select("id")
    .eq("wa_message_id", input.waMessageId)
    .maybeSingle();

  if (existing) {
    return { inserted: false, message: null };
  }

  const parsed = parseMeterEmail("", input.bodyText);
  const parseStatus = getParseStatusFromParsed(parsed);

  const { data, error } = await supabase
    .from("whatsapp_inbox_messages")
    .insert({
      wa_message_id: input.waMessageId,
      from_wa_id: input.fromWaId,
      from_profile_name: input.fromProfileName,
      body_text: input.bodyText,
      received_at: input.receivedAt,
      parsed,
      parse_status: parseStatus,
    })
    .select(INBOX_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return { inserted: false, message: null };
    }
    throw new Error(error.message);
  }

  return {
    inserted: true,
    message: data ? mapInboxRow(data as InboxRow) : null,
  };
}

export async function forceReparseAllWhatsappInboxMessages(): Promise<number> {
  requireDb();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_inbox_messages")
    .select("id, body_text")
    .order("fetched_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  let updatedCount = 0;
  for (const row of data ?? []) {
    await updateParsedInboxRow(row.id, row.body_text ?? "");
    updatedCount += 1;
  }

  return updatedCount;
}

export async function deleteWhatsappInboxMessage(id: string): Promise<void> {
  requireDb();
  const supabase = createAdminClient();
  const { error } = await supabase.from("whatsapp_inbox_messages").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markWhatsappInboxSubmissionImported(
  id: string,
  input: { clientId: string; month: string },
): Promise<void> {
  requireDb();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("whatsapp_inbox_messages")
    .update({
      submission_imported_at: new Date().toISOString(),
      submission_month: input.month,
      submission_client_id: input.clientId,
      submission_import_error: "",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markWhatsappInboxSubmissionImportFailed(
  id: string,
  reason: string,
): Promise<void> {
  requireDb();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("whatsapp_inbox_messages")
    .update({
      submission_import_error: reason.slice(0, 500),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
