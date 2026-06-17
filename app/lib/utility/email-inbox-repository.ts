import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import {
  EMAIL_PARSE_VERSION,
  getParseStatusFromParsed,
  parseMeterEmail,
} from "@/app/lib/utility/parse-meter-email";
import type {
  EmailFetchState,
  EmailFetchSummary,
  EmailInboxMessage,
  ParsedMeterEmail,
} from "@/app/lib/utility/types";

type InboxRow = {
  id: string;
  imap_uid: number;
  message_id: string | null;
  from_address: string;
  subject: string;
  body_text: string;
  received_at: string | null;
  parsed: ParsedMeterEmail | string;
  parse_status: EmailInboxMessage["parseStatus"];
  fetched_at: string;
  submission_imported_at: string | null;
  submission_month: string | null;
  submission_client_id: string | null;
  submission_import_error: string;
};

const INBOX_SELECT_COLUMNS =
  "id, imap_uid, message_id, from_address, subject, body_text, received_at, parsed, parse_status, fetched_at, submission_imported_at, submission_month, submission_client_id, submission_import_error";

type FetchStateRow = {
  last_imap_uid: number;
  last_fetch_at: string | null;
  last_fetch_status: string;
  last_error: string;
};

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

function mapInboxRow(row: InboxRow): EmailInboxMessage {
  return {
    id: row.id,
    imapUid: Number(row.imap_uid),
    messageId: row.message_id,
    fromAddress: row.from_address ?? "",
    subject: row.subject ?? "",
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

export async function loadEmailFetchState(): Promise<EmailFetchState> {
  requireDb();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_fetch_state")
    .select("last_imap_uid, last_fetch_at, last_fetch_status, last_error")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as FetchStateRow | null;
  return {
    lastImapUid: Number(row?.last_imap_uid ?? 0),
    lastFetchAt: row?.last_fetch_at ?? null,
    lastFetchStatus: row?.last_fetch_status ?? "never",
    lastError: row?.last_error ?? "",
  };
}

export async function updateEmailFetchState(input: {
  lastImapUid?: number;
  lastFetchAt: string;
  lastFetchStatus: string;
  lastError?: string;
}): Promise<void> {
  requireDb();
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = {
    last_fetch_at: input.lastFetchAt,
    last_fetch_status: input.lastFetchStatus,
    last_error: input.lastError ?? "",
  };

  if (input.lastImapUid !== undefined) {
    payload.last_imap_uid = input.lastImapUid;
  }

  const { error } = await supabase.from("email_fetch_state").update(payload).eq("id", 1);
  if (error) {
    throw new Error(error.message);
  }
}

export async function listEmailInboxMessages(limit = 50): Promise<EmailInboxMessage[]> {
  requireDb();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_inbox_messages")
    .select(INBOX_SELECT_COLUMNS)
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InboxRow[]).map(mapInboxRow);
}

async function updateParsedInboxRow(
  id: string,
  subject: string,
  bodyText: string,
): Promise<void> {
  const supabase = createAdminClient();
  const reparsed = parseMeterEmail(subject, bodyText);
  const parseStatus = getParseStatusFromParsed(reparsed);
  const { error } = await supabase
    .from("email_inbox_messages")
    .update({ parsed: reparsed, parse_status: parseStatus })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/** Pārparsē tikai vecās versijas ierakstus (ierobežots batches, lai neizsauktu 500). */
export async function reparseOutdatedEmailInboxMessages(batchSize = 20): Promise<number> {
  requireDb();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_inbox_messages")
    .select("id, subject, body_text, parsed")
    .order("fetched_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  let updatedCount = 0;

  for (const row of data ?? []) {
    if (updatedCount >= batchSize) {
      break;
    }

    const stored = safeParseStoredParsed(row.parsed);
    if ((stored.parseVersion ?? 0) >= EMAIL_PARSE_VERSION) {
      continue;
    }

    await updateParsedInboxRow(row.id, row.subject ?? "", row.body_text ?? "");
    updatedCount += 1;
  }

  return updatedCount;
}

export async function insertEmailInboxMessage(input: {
  imapUid: number;
  messageId: string | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: string | null;
}): Promise<{ inserted: boolean; message: EmailInboxMessage | null }> {
  requireDb();
  const supabase = createAdminClient();

  if (input.messageId) {
    const { data: existing } = await supabase
      .from("email_inbox_messages")
      .select("id")
      .eq("message_id", input.messageId)
      .maybeSingle();

    if (existing) {
      return { inserted: false, message: null };
    }
  }

  const parsed = parseMeterEmail(input.subject, input.bodyText);
  const parseStatus = getParseStatusFromParsed(parsed);

  const { data, error } = await supabase
    .from("email_inbox_messages")
    .insert({
      imap_uid: input.imapUid,
      message_id: input.messageId,
      from_address: input.fromAddress,
      subject: input.subject,
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

export async function summarizeRecentEmailFetch(sinceIso: string): Promise<EmailFetchSummary> {
  requireDb();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_inbox_messages")
    .select("parse_status")
    .gte("fetched_at", sinceIso);

  if (error) {
    throw new Error(error.message);
  }

  const parseStatusCounts: Record<string, number> = {};
  for (const row of data ?? []) {
    const status = (row as { parse_status: string }).parse_status;
    parseStatusCounts[status] = (parseStatusCounts[status] ?? 0) + 1;
  }

  const newCount = data?.length ?? 0;

  return {
    fetchedCount: newCount,
    newCount,
    parseStatusCounts,
  };
}

export async function reparseAllEmailInboxMessages(): Promise<number> {
  requireDb();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_inbox_messages")
    .select("id, subject, body_text")
    .order("fetched_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  let updatedCount = 0;

  for (const row of data ?? []) {
    await updateParsedInboxRow(row.id, row.subject ?? "", row.body_text ?? "");
    updatedCount += 1;
  }

  return updatedCount;
}

export async function deleteEmailInboxMessage(id: string): Promise<void> {
  requireDb();
  const supabase = createAdminClient();
  const { error } = await supabase.from("email_inbox_messages").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markEmailInboxSubmissionImported(
  id: string,
  input: { clientId: string; month: string },
): Promise<void> {
  requireDb();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("email_inbox_messages")
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

export async function markEmailInboxSubmissionImportFailed(
  id: string,
  reason: string,
): Promise<void> {
  requireDb();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("email_inbox_messages")
    .update({
      submission_import_error: reason.slice(0, 500),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
