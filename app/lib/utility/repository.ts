import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import { readableSupabaseError } from "@/app/lib/supabase/fetch";
import { isContactEmailTransportConfigured } from "@/app/lib/utility/email-password";
import { isContactInboxConfigured } from "@/app/lib/utility/imap-config";
import {
  hasStoredOrEnvWhatsappAccessToken,
  isWhatsappApiConfigured,
} from "@/app/lib/utility/whatsapp-config";
import type {
  AdminContactSettings,
  ContactSettingsUpdate,
  MeterType,
  PublicContactSettings,
  PublicLookupResult,
  UtilityClient,
  UtilityMeter,
  UtilityState,
  UtilitySubmission,
  WhatsappMode,
} from "@/app/lib/utility/types";
import { createLookupSubmissionToken } from "@/app/lib/security/lookup-token";
import { getCurrentMonthKey, normalizeLookup, roundReading } from "@/app/lib/utility/helpers";
import {
  getReadingWindowStatus,
  normalizeReadingWindowDays,
  readingWindowClosedMessage,
} from "@/app/lib/utility/reading-window";
import {
  isGoogleSheetsSyncConfigured,
  syncSubmissionToGoogleSheet,
  syncSubmissionToGoogleSheetRequired,
  syncSubmissionToGoogleSheetSafely,
} from "@/app/lib/utility/google-sheets-sync";

type ClientRow = {
  id: string;
  client_number: string;
  name?: string | null;
  address: string;
  email?: string | null;
  phone?: string | null;
  phone_extra?: string | null;
  extra_code?: string | null;
  public_token: string;
};

const CLIENT_SELECT_COLUMNS =
  "id, client_number, name, address, email, phone, phone_extra, extra_code, public_token";

function mapClientRow(client: ClientRow, meterIds: string[] = []): UtilityClient {
  return {
    id: client.id,
    clientNumber: client.client_number,
    name: client.name?.trim() ?? "",
    address: client.address,
    email: client.email?.trim() ?? "",
    phone: client.phone?.trim() ?? "",
    phoneExtra: client.phone_extra?.trim() ?? "",
    extraCode: client.extra_code?.trim() ?? "",
    meterIds,
    publicToken: client.public_token,
  };
}

type MeterRow = {
  id: string;
  number: string;
  type: MeterType;
  type_code?: string | null;
  verification_date: string | null;
  valid_until?: string | null;
  client_id: string | null;
  location: string;
  address?: string | null;
  previous_reading: number | string;
  baseline_reading?: number | string | null;
  reading_registered_on?: string | null;
  reading_period_end?: string | null;
  reading_record_number?: string | null;
};

function isoDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function toDbDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

type ContactSettingsRow = {
  email: string;
  sms_number: string;
  whatsapp_number: string;
  phone_number: string;
  reading_submission_template?: string;
  reading_window_days?: number | string | null;
  imap_host?: string;
  email_password?: string;
  whatsapp_mode?: string;
  whatsapp_message_template?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_notify_number?: string;
  whatsapp_template_name?: string;
  whatsapp_template_language?: string;
  whatsapp_access_token?: string;
};

type SubmissionRow = {
  client_id: string;
  month: string;
  submitted_at: string;
  readings: Record<string, number> | string;
};

export type GoogleSheetMonthSyncSummary = {
  syncedCount: number;
  spreadsheetUrl: string | null;
};

const METER_COLUMNS_BASE =
  "id, number, type, verification_date, client_id, location, previous_reading";
const METER_COLUMNS_WITH_BASELINE = [
  METER_COLUMNS_BASE,
  "baseline_reading",
  "type_code",
  "valid_until",
  "address",
  "reading_registered_on",
  "reading_period_end",
  "reading_record_number",
].join(", ");

const CONTACT_SETTINGS_BASE_COLUMNS = ["email", "sms_number", "whatsapp_number", "phone_number"];
const CONTACT_SETTINGS_ADMIN_COLUMNS = ["imap_host", "email_password"];
const READING_TEMPLATE_COLUMNS = ["reading_submission_template"];
const READING_WINDOW_COLUMNS = ["reading_window_days"];
const WHATSAPP_PUBLIC_COLUMNS = ["whatsapp_mode", "whatsapp_message_template"];
const WHATSAPP_ADMIN_COLUMNS = [
  "whatsapp_phone_number_id",
  "whatsapp_notify_number",
  "whatsapp_template_name",
  "whatsapp_template_language",
  "whatsapp_access_token",
];
const CONTACT_SETTINGS_ATTEMPTS = 3;
const ADMIN_DATA_PAGE_SIZE = 1000;

let meterBaselineColumnAvailable: boolean | null = null;
let readingSubmissionTemplateColumnAvailable: boolean | null = null;
let readingWindowDaysColumnAvailable: boolean | null = null;
let whatsappColumnsAvailable: boolean | null = null;

function isMissingBaselineColumnError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  return message.includes("baseline_reading") && message.includes("does not exist");
}

function isMissingColumnError(message: string | undefined, column: string): boolean {
  if (!message) {
    return false;
  }

  return (
    message.includes(column) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function isMissingWhatsappColumnError(message: string | undefined): boolean {
  return [...WHATSAPP_PUBLIC_COLUMNS, ...WHATSAPP_ADMIN_COLUMNS].some((column) =>
    isMissingColumnError(message, column),
  );
}

function hasCustomReadingSubmissionTemplate(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function buildContactSettingsColumns(includeAdminFields: boolean): string {
  const columns = [...CONTACT_SETTINGS_BASE_COLUMNS];

  if (includeAdminFields) {
    columns.push(...CONTACT_SETTINGS_ADMIN_COLUMNS);
  }

  if (readingSubmissionTemplateColumnAvailable !== false) {
    columns.push(...READING_TEMPLATE_COLUMNS);
  }

  if (readingWindowDaysColumnAvailable !== false) {
    columns.push(...READING_WINDOW_COLUMNS);
  }

  if (whatsappColumnsAvailable !== false) {
    columns.push(...WHATSAPP_PUBLIC_COLUMNS);
    if (includeAdminFields) {
      columns.push(...WHATSAPP_ADMIN_COLUMNS);
    }
  }

  return columns.join(", ");
}

function markOptionalContactSettingsColumnsAvailable() {
  if (readingSubmissionTemplateColumnAvailable === null) {
    readingSubmissionTemplateColumnAvailable = true;
  }

  if (readingWindowDaysColumnAvailable === null) {
    readingWindowDaysColumnAvailable = true;
  }

  if (whatsappColumnsAvailable === null) {
    whatsappColumnsAvailable = true;
  }
}

/** Atgriež true, ja kļūda bija par vēl nemigrētu kolonnu un pieprasījumu var atkārtot bez tās. */
function markMissingOptionalContactSettingsColumn(message: string | undefined): boolean {
  if (
    readingSubmissionTemplateColumnAvailable !== false &&
    isMissingColumnError(message, "reading_submission_template")
  ) {
    readingSubmissionTemplateColumnAvailable = false;
    return true;
  }

  if (
    readingWindowDaysColumnAvailable !== false &&
    isMissingColumnError(message, "reading_window_days")
  ) {
    readingWindowDaysColumnAvailable = false;
    return true;
  }

  if (whatsappColumnsAvailable !== false && isMissingWhatsappColumnError(message)) {
    whatsappColumnsAvailable = false;
    return true;
  }

  return false;
}

type MeterQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

async function queryMeterRows(
  supabase: ReturnType<typeof createAdminClient>,
  runQuery: (columns: string) => Promise<MeterQueryResult>,
): Promise<MeterRow[]> {
  if (meterBaselineColumnAvailable !== false) {
    const withBaseline = await runQuery(METER_COLUMNS_WITH_BASELINE);
    if (!withBaseline.error) {
      meterBaselineColumnAvailable = true;
      return (withBaseline.data ?? []) as MeterRow[];
    }

    if (isMissingBaselineColumnError(withBaseline.error.message)) {
      meterBaselineColumnAvailable = false;
    } else {
      throw new Error(withBaseline.error.message);
    }
  }

  const withoutBaseline = await runQuery(METER_COLUMNS_BASE);
  if (withoutBaseline.error) {
    throw new Error(withoutBaseline.error.message);
  }

  return (withoutBaseline.data ?? []) as MeterRow[];
}

async function queryContactSettingsRow(
  supabase: ReturnType<typeof createAdminClient>,
  options: { includeAdminFields: boolean },
): Promise<ContactSettingsRow> {
  for (let attempt = 0; attempt < CONTACT_SETTINGS_ATTEMPTS; attempt += 1) {
    const result = await supabase
      .from("contact_settings")
      .select(buildContactSettingsColumns(options.includeAdminFields))
      .eq("id", 1)
      .maybeSingle();

    if (!result.error) {
      markOptionalContactSettingsColumnsAvailable();

      if (!result.data) {
        throw new Error("Kontaktu iestatījumi nav atrasti.");
      }

      return result.data as unknown as ContactSettingsRow;
    }

    if (!markMissingOptionalContactSettingsColumn(result.error.message)) {
      throw new Error(readableSupabaseError(result.error.message));
    }
  }

  throw new Error("Neizdevās nolasīt kontaktu iestatījumus.");
}

function requireDb() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase nav konfigurēts. Pievienojiet vides mainīgos.");
  }
}

function normalizeWhatsappMode(value: string | undefined): WhatsappMode {
  return value === "link" || value === "api" ? value : "off";
}

function mapPublicSettings(row: ContactSettingsRow): PublicContactSettings {
  return {
    email: row.email,
    smsNumber: row.sms_number,
    whatsappNumber: row.whatsapp_number,
    phoneNumber: row.phone_number,
    readingSubmissionTemplate: row.reading_submission_template?.trim() ?? "",
    readingWindowDays: normalizeReadingWindowDays(Number(row.reading_window_days ?? 0)),
    whatsappMode: normalizeWhatsappMode(row.whatsapp_mode),
    whatsappMessageTemplate: row.whatsapp_message_template?.trim() ?? "",
  };
}

function mapAdminSettings(row: ContactSettingsRow): AdminContactSettings {
  const whatsappPhoneNumberId = row.whatsapp_phone_number_id?.trim() ?? "";
  const whatsappNotifyNumber = row.whatsapp_notify_number?.trim() ?? "";

  return {
    ...mapPublicSettings(row),
    imapHost: row.imap_host?.trim() ?? "",
    emailPasswordConfigured: isContactEmailTransportConfigured() || Boolean(row.email_password?.trim()),
    emailInboxConfigured: isContactInboxConfigured(
      row.email,
      row.imap_host ?? "",
      row.email_password,
    ),
    whatsappPhoneNumberId,
    whatsappNotifyNumber,
    whatsappTemplateName: row.whatsapp_template_name?.trim() ?? "",
    whatsappTemplateLanguage: row.whatsapp_template_language?.trim() ?? "lv",
    whatsappAccessTokenConfigured: hasStoredOrEnvWhatsappAccessToken(row.whatsapp_access_token),
    whatsappApiConfigured: isWhatsappApiConfigured(
      whatsappPhoneNumberId,
      whatsappNotifyNumber,
      row.whatsapp_access_token,
    ),
  };
}

function mapMeter(row: MeterRow): UtilityMeter {
  const verificationDate = isoDate(row.verification_date);
  const validUntil = isoDate(row.valid_until) || verificationDate;

  return {
    id: row.id,
    number: row.number,
    type: row.type,
    typeCode: row.type_code?.trim() ?? "",
    verificationDate,
    validUntil,
    clientId: row.client_id ?? "",
    location: row.location,
    address: row.address?.trim() ?? "",
    previousReading: roundReading(Number(row.previous_reading)),
    baselineReading: roundReading(Number(row.baseline_reading ?? row.previous_reading)),
    readingRegisteredOn: isoDate(row.reading_registered_on),
    readingPeriodEnd: isoDate(row.reading_period_end),
    readingRecordNumber: row.reading_record_number?.trim() ?? "",
  };
}

function enrichSubmissionsWithBaselines(
  submissions: UtilitySubmission[],
  meters: UtilityMeter[],
): UtilitySubmission[] {
  const meterById = new Map(meters.map((meter) => [meter.id, meter]));

  return submissions.map((submission) => {
    if (submission.previousReadings) {
      return submission;
    }

    const previousReadings: Record<string, number> = {};
    for (const meterId of Object.keys(submission.readings)) {
      const meter = meterById.get(meterId);
      if (meter) {
        previousReadings[meterId] = meter.baselineReading;
      }
    }

    return { ...submission, previousReadings };
  });
}

function attachMeterIds(clients: ClientRow[], meters: UtilityMeter[]): UtilityClient[] {
  const meterIdsByClientId = new Map<string, string[]>();
  for (const meter of meters) {
    const current = meterIdsByClientId.get(meter.clientId) ?? [];
    current.push(meter.id);
    meterIdsByClientId.set(meter.clientId, current);
  }

  return clients.map((client) =>
    mapClientRow(client, meterIdsByClientId.get(client.id) ?? []),
  );
}

type StoredSubmissionReadings =
  | Record<string, number>
  | {
      values: Record<string, number>;
      previous?: Record<string, number>;
    };

function isWrappedSubmissionReadings(
  raw: StoredSubmissionReadings,
): raw is { values: Record<string, number>; previous?: Record<string, number> } {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "values" in raw &&
    typeof raw.values === "object" &&
    raw.values !== null
  );
}

function coerceReading(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return roundReading(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return roundReading(parsed);
    }
  }

  return undefined;
}

function mapSubmission(row: SubmissionRow): UtilitySubmission {
  const raw =
    typeof row.readings === "string"
      ? (JSON.parse(row.readings) as StoredSubmissionReadings)
      : row.readings;

  if (isWrappedSubmissionReadings(raw)) {
    return {
      clientId: row.client_id,
      month: row.month,
      submittedAt: row.submitted_at,
      readings: raw.values,
      previousReadings: raw.previous,
    };
  }

  return {
    clientId: row.client_id,
    month: row.month,
    submittedAt: row.submitted_at,
    readings: raw as Record<string, number>,
  };
}

async function syncReadingsSubmissionToGoogleSheet(
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string,
  month: string,
  readings: Record<string, number>,
  previousReadings: Record<string, number>,
  submittedAt: string,
  validatedSubmission?: {
    client: UtilityClient;
    meters: UtilityMeter[];
  },
  required = false,
): Promise<void> {
  if (!isGoogleSheetsSyncConfigured()) {
    if (required) {
      throw new Error("Google Sheets nav konfigurēts servera vidē.");
    }
    return;
  }

  try {
    const syncSubmission = required
      ? syncSubmissionToGoogleSheetRequired
      : syncSubmissionToGoogleSheetSafely;

    if (validatedSubmission) {
      await syncSubmission(supabase, {
        month,
        submittedAt,
        client: validatedSubmission.client,
        meters: validatedSubmission.meters,
        readings,
        previousReadings,
      });
      return;
    }

    const [clientResult, meterRows] = await Promise.all([
      supabase
        .from("clients")
        .select(CLIENT_SELECT_COLUMNS)
        .eq("id", clientId)
        .maybeSingle(),
      queryMeterRows(supabase, async (columns) =>
        supabase.from("meters").select(columns).eq("client_id", clientId),
      ),
    ]);

    if (clientResult.error) {
      throw new Error(clientResult.error.message);
    }

    if (!clientResult.data) {
      throw new Error("Klients nav atrasts Google Sheets sinhronizācijai.");
    }

    const meters = meterRows.map(mapMeter);
    const clientRow = clientResult.data as ClientRow;

    await syncSubmission(supabase, {
      month,
      submittedAt,
      client: mapClientRow(
        clientRow,
        meters.map((meter) => meter.id),
      ),
      meters,
      readings,
      previousReadings,
    });
  } catch (error) {
    console.error("Google Sheets submission preparation failed:", error);
    if (required) {
      throw error;
    }
  }
}

async function updateMeterPreviousReadings(
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string,
  readings: Record<string, number>,
): Promise<void> {
  const meterResults = await Promise.all(
    Object.entries(readings).map(([meterId, reading]) =>
      supabase
        .from("meters")
        .update({ previous_reading: roundReading(reading) })
        .eq("id", meterId)
        .eq("client_id", clientId),
    ),
  );

  const meterError = meterResults.find((result) => result.error)?.error;
  if (meterError) {
    throw new Error(meterError.message);
  }
}

function previousReadingsForSubmitted(
  readings: Record<string, number>,
  previousReadings: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const meterId of Object.keys(readings)) {
    const previous = previousReadings[meterId];
    if (previous !== undefined) {
      result[meterId] = previous;
    }
  }
  return result;
}

function readStoredSubmissionValues(raw: SubmissionRow["readings"]): {
  values: Record<string, number>;
  previous: Record<string, number>;
} {
  const parsed =
    typeof raw === "string" ? (JSON.parse(raw) as StoredSubmissionReadings) : raw;
  if (isWrappedSubmissionReadings(parsed)) {
    return {
      values: parsed.values,
      previous: parsed.previous ?? {},
    };
  }

  return {
    values: parsed as Record<string, number>,
    previous: {},
  };
}

async function restoreMeterPreviousReadings(
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string,
  previousReadings: Record<string, number>,
): Promise<void> {
  const rollbackResults = await Promise.all(
    Object.entries(previousReadings).map(([meterId, reading]) =>
      supabase
        .from("meters")
        .update({ previous_reading: roundReading(reading) })
        .eq("id", meterId)
        .eq("client_id", clientId),
    ),
  );

  const rollbackError = rollbackResults.find((result) => result.error)?.error;
  if (rollbackError) {
    throw new Error(rollbackError.message);
  }
}

async function rollbackSubmittedReadings(
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string,
  month: string,
  previousReadings: Record<string, number>,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("readings_submissions")
    .delete()
    .eq("client_id", clientId)
    .eq("month", month);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await restoreMeterPreviousReadings(supabase, clientId, previousReadings);
}

async function loadClientRows(supabase: ReturnType<typeof createAdminClient>): Promise<ClientRow[]> {
  const rows: ClientRow[] = [];

  for (let from = 0; ; from += ADMIN_DATA_PAGE_SIZE) {
    const clientsResult = await supabase
      .from("clients")
      .select(CLIENT_SELECT_COLUMNS)
      .order("client_number")
      .order("id")
      .range(from, from + ADMIN_DATA_PAGE_SIZE - 1);

    if (clientsResult.error) {
      throw new Error(clientsResult.error.message || "Failed to load utility clients");
    }

    const page = (clientsResult.data ?? []) as ClientRow[];
    rows.push(...page);
    if (page.length < ADMIN_DATA_PAGE_SIZE) {
      return rows;
    }
  }
}

async function loadMappedMeters(supabase: ReturnType<typeof createAdminClient>): Promise<UtilityMeter[]> {
  const meterRows: MeterRow[] = [];

  for (let from = 0; ; from += ADMIN_DATA_PAGE_SIZE) {
    const page = await queryMeterRows(supabase, async (columns) =>
      supabase
        .from("meters")
        .select(columns)
        .order("number")
        .order("id")
        .range(from, from + ADMIN_DATA_PAGE_SIZE - 1),
    );

    meterRows.push(...page);
    if (page.length < ADMIN_DATA_PAGE_SIZE) {
      break;
    }
  }

  return meterRows.map(mapMeter);
}

async function loadClientsAndMeters(
  supabase: ReturnType<typeof createAdminClient>,
) {
  const [clientRows, meters] = await Promise.all([
    loadClientRows(supabase),
    loadMappedMeters(supabase),
  ]);

  return { clients: attachMeterIds(clientRows, meters), meters };
}

async function loadSubmissionsForMonth(
  supabase: ReturnType<typeof createAdminClient>,
  submissionsMonth: string,
  meters: UtilityMeter[],
): Promise<UtilitySubmission[]> {
  const submissionRows: SubmissionRow[] = [];

  for (let from = 0; ; from += ADMIN_DATA_PAGE_SIZE) {
    const submissionsResult = await supabase
      .from("readings_submissions")
      .select("client_id, month, submitted_at, readings")
      .eq("month", submissionsMonth)
      .order("submitted_at", { ascending: false })
      .order("client_id")
      .range(from, from + ADMIN_DATA_PAGE_SIZE - 1);

    if (submissionsResult.error) {
      throw new Error(submissionsResult.error.message || "Failed to load utility submissions");
    }

    const page = (submissionsResult.data ?? []) as SubmissionRow[];
    submissionRows.push(...page);
    if (page.length < ADMIN_DATA_PAGE_SIZE) {
      break;
    }
  }

  return enrichSubmissionsWithBaselines(
    submissionRows.map(mapSubmission),
    meters,
  );
}

export async function loadPublicContactSettings(): Promise<PublicContactSettings> {
  requireDb();
  const supabase = createAdminClient();
  const data = await queryContactSettingsRow(supabase, { includeAdminFields: false });
  return mapPublicSettings(data);
}

export async function loadAdminClients(): Promise<UtilityClient[]> {
  requireDb();
  const supabase = createAdminClient();
  const [clientRows, meters] = await Promise.all([loadClientRows(supabase), loadMappedMeters(supabase)]);
  return attachMeterIds(clientRows, meters);
}

export async function loadAdminMeters(): Promise<UtilityMeter[]> {
  requireDb();
  const supabase = createAdminClient();
  return loadMappedMeters(supabase);
}

export async function loadAdminSettings(): Promise<AdminContactSettings> {
  requireDb();
  const supabase = createAdminClient();
  const settingsRow = await queryContactSettingsRow(supabase, { includeAdminFields: true });
  return mapAdminSettings(settingsRow);
}

export async function loadAdminSubmissions(submissionsMonth = getCurrentMonthKey()): Promise<UtilitySubmission[]> {
  requireDb();
  const supabase = createAdminClient();
  const meters = await loadMappedMeters(supabase);
  return loadSubmissionsForMonth(supabase, submissionsMonth, meters);
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

async function findPublicClientRow(
  supabase: ReturnType<typeof createAdminClient>,
  query: string,
): Promise<ClientRow | null> {
  const trimmed = query.trim();
  const normalized = normalizeLookup(query);
  if (!trimmed || !normalized) {
    return null;
  }

  const exactNumber = await supabase
    .from("clients")
    .select(CLIENT_SELECT_COLUMNS)
    .eq("client_number", trimmed)
    .maybeSingle();

  if (exactNumber.error) {
    throw new Error(exactNumber.error.message || "Lookup failed");
  }

  if (exactNumber.data) {
    return exactNumber.data as ClientRow;
  }

  const caseInsensitive = await supabase
    .from("clients")
    .select(CLIENT_SELECT_COLUMNS)
    .ilike("client_number", escapeIlike(trimmed))
    .maybeSingle();

  if (caseInsensitive.error) {
    throw new Error(caseInsensitive.error.message || "Lookup failed");
  }

  return (caseInsensitive.data as ClientRow | null) ?? null;
}

async function buildPublicLookupResult(
  supabase: ReturnType<typeof createAdminClient>,
  clientRow: ClientRow,
): Promise<PublicLookupResult> {
  const month = getCurrentMonthKey();
  const [meterRows, submissionResult] = await Promise.all([
    queryMeterRows(supabase, async (columns) =>
      supabase.from("meters").select(columns).eq("client_id", clientRow.id).order("number"),
    ),
    supabase
      .from("readings_submissions")
      .select("client_id, month, submitted_at, readings")
      .eq("client_id", clientRow.id)
      .eq("month", month)
      .maybeSingle(),
  ]);

  if (submissionResult.error) {
    throw new Error(submissionResult.error.message);
  }

  const clientMeters = meterRows.map(mapMeter);
  const client = mapClientRow(
    clientRow,
    clientMeters.map((meter) => meter.id),
  );
  const submission = submissionResult.data
    ? mapSubmission(submissionResult.data as SubmissionRow)
    : null;
  const submittedReadings: Record<string, number> = {};
  const submittedPreviousReadings: Record<string, number> = {};

  for (const meter of clientMeters) {
    const reading = coerceReading(submission?.readings[meter.id]);
    if (reading === undefined) {
      continue;
    }

    submittedReadings[meter.id] = reading;
    const previous = coerceReading(submission?.previousReadings?.[meter.id]);
    if (previous !== undefined) {
      submittedPreviousReadings[meter.id] = previous;
    }
  }

  return {
    client,
    meters: clientMeters,
    hasSubmissionThisMonth:
      clientMeters.length > 0 &&
      clientMeters.every((meter) => submittedReadings[meter.id] !== undefined),
    submittedReadings,
    submittedPreviousReadings,
    submissionToken: createLookupSubmissionToken(client.id),
  };
}

export async function lookupPublicClientInDb(query: string): Promise<PublicLookupResult | null> {
  requireDb();
  const supabase = createAdminClient();

  const clientRow = await findPublicClientRow(supabase, query);
  if (!clientRow) {
    return null;
  }

  return buildPublicLookupResult(supabase, clientRow);
}

export async function lookupPublicClientByTokenInDb(token: string): Promise<PublicLookupResult | null> {
  requireDb();
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const supabase = createAdminClient();
  const clientResult = await supabase
    .from("clients")
    .select(CLIENT_SELECT_COLUMNS)
    .eq("public_token", trimmed)
    .maybeSingle();

  if (clientResult.error) {
    throw new Error(clientResult.error.message || "Lookup failed");
  }

  if (!clientResult.data) {
    return null;
  }

  return buildPublicLookupResult(supabase, clientResult.data as ClientRow);
}

export type PublicSubmissionValidation =
  | {
      ok: true;
      month: string;
      client: UtilityClient;
      meters: UtilityMeter[];
      readings: Record<string, number>;
    }
  | { ok: false; status: number; message: string };

export async function validatePublicSubmissionInDb(
  clientId: string,
  readings: Record<string, number>,
): Promise<PublicSubmissionValidation> {
  requireDb();
  const supabase = createAdminClient();
  const month = getCurrentMonthKey();

  const [clientResult, meterRows, submissionResult] = await Promise.all([
    supabase
      .from("clients")
      .select(CLIENT_SELECT_COLUMNS)
      .eq("id", clientId)
      .maybeSingle(),
    queryMeterRows(supabase, async (columns) =>
      supabase.from("meters").select(columns).eq("client_id", clientId),
    ),
    supabase
      .from("readings_submissions")
      .select("client_id, month, submitted_at, readings")
      .eq("client_id", clientId)
      .eq("month", month)
      .maybeSingle(),
  ]);

  if (clientResult.error) {
    throw new Error(clientResult.error.message);
  }

  if (!clientResult.data) {
    return { ok: false, status: 404, message: "Klients nav atrasts." };
  }

  const publicSettings = await loadPublicContactSettings();
  const readingWindow = getReadingWindowStatus(publicSettings.readingWindowDays);
  if (!readingWindow.open) {
    return { ok: false, status: 403, message: readingWindowClosedMessage(readingWindow) };
  }

  const meters = meterRows.map(mapMeter);
  if (meters.length === 0) {
    return { ok: false, status: 400, message: "Klientam nav piesaistītu skaitītāju." };
  }

  if (submissionResult.error) {
    throw new Error(submissionResult.error.message);
  }

  const existingSubmission = submissionResult.data
    ? mapSubmission(submissionResult.data as SubmissionRow)
    : null;
  const existingReadings = existingSubmission?.readings ?? {};
  const meterById = new Map(meters.map((meter) => [meter.id, meter]));
  const pendingMeters = meters.filter((meter) => coerceReading(existingReadings[meter.id]) === undefined);

  if (meters.length > 0 && pendingMeters.length === 0) {
    return { ok: false, status: 409, message: "Rādījumi šim mēnesim jau ir iesniegti." };
  }

  const acceptedReadings: Record<string, number> = {};
  for (const [meterId, current] of Object.entries(readings)) {
    const meter = meterById.get(meterId);
    if (!meter) {
      return { ok: false, status: 400, message: "Norādīts skaitītājs, kas nepieder klientam." };
    }

    const alreadySubmitted = coerceReading(existingReadings[meterId]);
    if (alreadySubmitted !== undefined) {
      if (alreadySubmitted !== roundReading(current)) {
        return {
          ok: false,
          status: 409,
          message: `Skaitītāja ${meter.number} rādījums jau ir iesniegts un to nevar labot.`,
        };
      }
      continue;
    }

    if (current < meter.previousReading) {
      return {
        ok: false,
        status: 400,
        message: `Skaitītājam ${meter.number} rādījums nevar būt mazāks par iepriekšējo periodu.`,
      };
    }

    acceptedReadings[meterId] = roundReading(current);
  }

  if (Object.keys(acceptedReadings).length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Ievadiet rādījumu vismaz vienam skaitītājam, kurš vēl nav iesniegts.",
    };
  }

  return {
    ok: true,
    month,
    client: mapClientRow(
      clientResult.data as ClientRow,
      meters.map((meter) => meter.id),
    ),
    meters,
    readings: acceptedReadings,
  };
}

export async function loadUtilityAdminState(submissionsMonth = getCurrentMonthKey()): Promise<UtilityState> {
  requireDb();
  const supabase = createAdminClient();
  const [settingsRow, referenceData] = await Promise.all([
    queryContactSettingsRow(supabase, { includeAdminFields: true }),
    loadClientsAndMeters(supabase),
  ]);
  const submissions = await loadSubmissionsForMonth(supabase, submissionsMonth, referenceData.meters);

  return {
    clients: referenceData.clients,
    meters: referenceData.meters,
    submissions,
    settings: mapAdminSettings(settingsRow),
  };
}

export async function syncGoogleSheetMonthInDb(month: string): Promise<GoogleSheetMonthSyncSummary> {
  if (!isGoogleSheetsSyncConfigured()) {
    throw new Error("Google Sheets nav konfigurēts servera vidē.");
  }

  const supabase = createAdminClient();
  const { clients, meters } = await loadClientsAndMeters(supabase);
  const monthSubmissions = await loadSubmissionsForMonth(supabase, month, meters);
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const metersByClientId = new Map<string, UtilityMeter[]>();
  for (const meter of meters) {
    const current = metersByClientId.get(meter.clientId) ?? [];
    current.push(meter);
    metersByClientId.set(meter.clientId, current);
  }
  let spreadsheetUrl: string | null = null;

  for (const submission of monthSubmissions) {
    const client = clientById.get(submission.clientId);
    if (!client) {
      continue;
    }

    const clientMeters = metersByClientId.get(client.id) ?? [];
    const result = await syncSubmissionToGoogleSheet(supabase, {
      month: submission.month,
      submittedAt: submission.submittedAt,
      client,
      meters: clientMeters,
      readings: submission.readings,
      previousReadings: submission.previousReadings ?? {},
    });

    if (result?.spreadsheetUrl) {
      spreadsheetUrl = result.spreadsheetUrl;
    }
  }

  return {
    syncedCount: monthSubmissions.length,
    spreadsheetUrl,
  };
}

function buildContactSettingsUpdatePayload(
  settings: ContactSettingsUpdate,
): Record<string, string | number> {
  const payload: Record<string, string | number> = {};

  if (settings.email !== undefined) {
    payload.email = settings.email;
  }

  if (settings.smsNumber !== undefined) {
    payload.sms_number = settings.smsNumber;
  }

  if (settings.whatsappNumber !== undefined) {
    payload.whatsapp_number = settings.whatsappNumber;
  }

  if (settings.phoneNumber !== undefined) {
    payload.phone_number = settings.phoneNumber;
  }

  if (settings.imapHost !== undefined) {
    payload.imap_host = settings.imapHost.trim();
  }

  if (settings.emailPassword?.trim()) {
    payload.email_password = settings.emailPassword.trim();
  }

  if (settings.readingSubmissionTemplate !== undefined) {
    if (readingSubmissionTemplateColumnAvailable === false) {
      if (hasCustomReadingSubmissionTemplate(settings.readingSubmissionTemplate)) {
        throw new Error(
          "FAQ rādījumu teksta lauks vēl nav aktivizēts datubāzē. Palaidiet migrāciju 015_contact_settings_reading_submission_template.sql un mēģiniet vēlreiz.",
        );
      }
    } else {
      payload.reading_submission_template = settings.readingSubmissionTemplate;
    }
  }

  if (settings.readingWindowDays !== undefined) {
    if (readingWindowDaysColumnAvailable === false) {
      if (normalizeReadingWindowDays(settings.readingWindowDays) > 0) {
        throw new Error(
          "Rādījumu perioda lauks vēl nav aktivizēts datubāzē. Palaidiet migrāciju 021_reading_window_days.sql un mēģiniet vēlreiz.",
        );
      }
    } else {
      payload.reading_window_days = normalizeReadingWindowDays(settings.readingWindowDays);
    }
  }

  const updatesWhatsapp =
    settings.whatsappMode !== undefined ||
    settings.whatsappMessageTemplate !== undefined ||
    settings.whatsappPhoneNumberId !== undefined ||
    settings.whatsappNotifyNumber !== undefined ||
    settings.whatsappTemplateName !== undefined ||
    settings.whatsappTemplateLanguage !== undefined ||
    Boolean(settings.whatsappAccessToken?.trim());

  if (updatesWhatsapp) {
    if (whatsappColumnsAvailable === false) {
      if (settings.whatsappMode && settings.whatsappMode !== "off") {
        throw new Error(
          "WhatsApp iestatījumi vēl nav aktivizēti datubāzē. Palaidiet migrāciju 018_contact_settings_whatsapp_business.sql un mēģiniet vēlreiz.",
        );
      }
    } else {
      if (settings.whatsappMode !== undefined) {
        payload.whatsapp_mode = settings.whatsappMode;
      }

      if (settings.whatsappMessageTemplate !== undefined) {
        payload.whatsapp_message_template = settings.whatsappMessageTemplate;
      }

      if (settings.whatsappPhoneNumberId !== undefined) {
        payload.whatsapp_phone_number_id = settings.whatsappPhoneNumberId.trim();
      }

      if (settings.whatsappNotifyNumber !== undefined) {
        payload.whatsapp_notify_number = settings.whatsappNotifyNumber.trim();
      }

      if (settings.whatsappTemplateName !== undefined) {
        payload.whatsapp_template_name = settings.whatsappTemplateName.trim();
      }

      if (settings.whatsappTemplateLanguage !== undefined) {
        payload.whatsapp_template_language = settings.whatsappTemplateLanguage.trim();
      }

      if (settings.whatsappAccessToken?.trim()) {
        payload.whatsapp_access_token = settings.whatsappAccessToken.trim();
      }
    }
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("Nav ko saglabāt.");
  }

  return payload;
}

export async function updateContactSettings(
  settings: ContactSettingsUpdate,
): Promise<AdminContactSettings> {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < CONTACT_SETTINGS_ATTEMPTS; attempt += 1) {
    const update = await supabase
      .from("contact_settings")
      .update(buildContactSettingsUpdatePayload(settings))
      .eq("id", 1)
      .select(buildContactSettingsColumns(true))
      .single();

    if (!update.error && update.data) {
      markOptionalContactSettingsColumnsAvailable();
      return mapAdminSettings(update.data as unknown as ContactSettingsRow);
    }

    if (!markMissingOptionalContactSettingsColumn(update.error?.message)) {
      throw new Error(update.error?.message || "Failed to update settings");
    }
  }

  throw new Error("Neizdevās saglabāt kontaktu iestatījumus.");
}

export async function submitReadingsInDb(
  clientId: string,
  month: string,
  readings: Record<string, number>,
  previousReadings: Record<string, number>,
  validatedSubmission?: {
    client: UtilityClient;
    meters: UtilityMeter[];
  },
  requireGoogleSheetSync = false,
): Promise<void> {
  const supabase = createAdminClient();
  const submittedAt = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("readings_submissions")
    .select("id, readings, submitted_at")
    .eq("client_id", clientId)
    .eq("month", month)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  let sheetReadings = readings;
  let sheetPreviousReadings = previousReadingsForSubmitted(readings, previousReadings);
  const appliedReadings: Record<string, number> = {};

  if (existing) {
    const stored = readStoredSubmissionValues(existing.readings as SubmissionRow["readings"]);
    const mergedValues = { ...stored.values };
    const mergedPrevious = { ...stored.previous };

    for (const [meterId, reading] of Object.entries(readings)) {
      const current = coerceReading(stored.values[meterId]);
      const rounded = roundReading(reading);
      if (current !== undefined) {
        if (current !== rounded) {
          throw new Error("Iesniegtais rādījums jau ir saglabāts un to nevar labot.");
        }
        continue;
      }

      mergedValues[meterId] = rounded;
      appliedReadings[meterId] = rounded;
      if (mergedPrevious[meterId] === undefined && previousReadings[meterId] !== undefined) {
        mergedPrevious[meterId] = previousReadings[meterId];
      }
    }

    if (Object.keys(appliedReadings).length === 0) {
      throw new Error("Rādījumi šim mēnesim jau ir iesniegti.");
    }

    sheetReadings = mergedValues;
    sheetPreviousReadings = mergedPrevious;

    const { error: updateError } = await supabase
      .from("readings_submissions")
      .update({
        readings: {
          values: mergedValues,
          previous: mergedPrevious,
        },
        submitted_at: submittedAt,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    for (const [meterId, reading] of Object.entries(readings)) {
      appliedReadings[meterId] = roundReading(reading);
    }

    const { error: insertError } = await supabase.from("readings_submissions").insert({
      client_id: clientId,
      month,
      submitted_at: submittedAt,
      readings: {
        values: appliedReadings,
        previous: sheetPreviousReadings,
      },
    });

    if (insertError) {
      const duplicate = insertError.code === "23505";
      throw new Error(
        duplicate
          ? "Daļa rādījumu jau ir iesniegta. Atveriet formu vēlreiz un iesniedziet tikai atlikušos skaitītājus."
          : insertError.message,
      );
    }
  }

  const rollbackPrevious = previousReadingsForSubmitted(appliedReadings, previousReadings);

  try {
    await updateMeterPreviousReadings(supabase, clientId, appliedReadings);
    await syncReadingsSubmissionToGoogleSheet(
      supabase,
      clientId,
      month,
      sheetReadings,
      sheetPreviousReadings,
      submittedAt,
      validatedSubmission,
      requireGoogleSheetSync,
    );
  } catch (error) {
    if (requireGoogleSheetSync) {
      try {
        if (existing) {
          const { error: restoreError } = await supabase
            .from("readings_submissions")
            .update({
              readings: existing.readings,
              submitted_at: existing.submitted_at,
            })
            .eq("id", existing.id);
          if (restoreError) {
            throw new Error(restoreError.message);
          }
          await restoreMeterPreviousReadings(supabase, clientId, rollbackPrevious);
        } else {
          await rollbackSubmittedReadings(supabase, clientId, month, rollbackPrevious);
        }
      } catch (rollbackError) {
        console.error("Failed to roll back readings after Google Sheets sync failure:", rollbackError);
      }
    }
    throw error;
  }
}

export async function upsertEmailReadingsInDb(
  clientId: string,
  month: string,
  readings: Record<string, number>,
  previousReadings: Record<string, number>,
): Promise<"created" | "merged"> {
  const supabase = createAdminClient();
  const submittedAt = new Date().toISOString();
  let sheetReadings = readings;
  let sheetPreviousReadings = previousReadings;

  const { data: existing, error: existingError } = await supabase
    .from("readings_submissions")
    .select("id, readings")
    .eq("client_id", clientId)
    .eq("month", month)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    const raw =
      typeof existing.readings === "string"
        ? (JSON.parse(existing.readings) as StoredSubmissionReadings)
        : existing.readings;
    const currentValues = isWrappedSubmissionReadings(raw) ? raw.values : (raw as Record<string, number>);
    const currentPrevious = isWrappedSubmissionReadings(raw) ? raw.previous : {};

    const mergedValues = { ...currentValues, ...readings };
    const mergedPrevious = { ...currentPrevious, ...previousReadings };
    sheetReadings = mergedValues;
    sheetPreviousReadings = mergedPrevious;

    const { error: updateError } = await supabase
      .from("readings_submissions")
      .update({
        readings: {
          values: mergedValues,
          previous: mergedPrevious,
        },
        submitted_at: submittedAt,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await supabase.from("readings_submissions").insert({
      client_id: clientId,
      month,
      submitted_at: submittedAt,
      readings: {
        values: readings,
        previous: previousReadings,
      },
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  for (const [meterId, reading] of Object.entries(readings)) {
    const { error: meterError } = await supabase
      .from("meters")
      .update({ previous_reading: roundReading(reading) })
      .eq("id", meterId)
      .eq("client_id", clientId);

    if (meterError) {
      throw new Error(meterError.message);
    }
  }

  await syncReadingsSubmissionToGoogleSheet(
    supabase,
    clientId,
    month,
    sheetReadings,
    sheetPreviousReadings,
    submittedAt,
  );

  return existing ? "merged" : "created";
}

export async function upsertClient(client: UtilityClient): Promise<UtilityClient> {
  const supabase = createAdminClient();
  const payload = {
    id: client.id,
    client_number: client.clientNumber.trim(),
    name: client.name.trim(),
    address: client.address.trim(),
    email: client.email.trim(),
    phone: client.phone.trim(),
    phone_extra: client.phoneExtra.trim(),
    extra_code: client.extraCode.trim(),
  };

  const { data, error } = await supabase
    .from("clients")
    .upsert(payload)
    .select(CLIENT_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save client");
  }

  return mapClientRow(data as ClientRow, client.meterIds);
}

export async function deleteClientById(clientId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("clients").delete().eq("id", clientId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertMeter(meter: UtilityMeter): Promise<UtilityMeter> {
  const supabase = createAdminClient();
  const validUntil = toDbDate(meter.validUntil || meter.verificationDate);
  const basePayload = {
    id: meter.id,
    number: meter.number.trim(),
    type: meter.type,
    type_code: meter.typeCode.trim(),
    verification_date: toDbDate(meter.verificationDate) ?? validUntil,
    valid_until: validUntil,
    client_id: meter.clientId || null,
    location: meter.location.trim(),
    address: meter.address.trim(),
    previous_reading: roundReading(meter.previousReading),
    reading_registered_on: toDbDate(meter.readingRegisteredOn),
    reading_period_end: toDbDate(meter.readingPeriodEnd),
    reading_record_number: meter.readingRecordNumber.trim(),
  };

  if (meterBaselineColumnAvailable !== false) {
    const withBaseline = await supabase
      .from("meters")
      .upsert({ ...basePayload, baseline_reading: roundReading(meter.baselineReading) })
      .select(METER_COLUMNS_WITH_BASELINE)
      .single();

    if (!withBaseline.error && withBaseline.data) {
      meterBaselineColumnAvailable = true;
      return mapMeter(withBaseline.data as unknown as MeterRow);
    }

    if (
      withBaseline.error &&
      !isMissingBaselineColumnError(withBaseline.error.message)
    ) {
      throw new Error(withBaseline.error.message || "Failed to save meter");
    }

    meterBaselineColumnAvailable = false;
  }

  const { data, error } = await supabase
    .from("meters")
    .upsert(basePayload)
    .select(METER_COLUMNS_BASE)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save meter");
  }

  return mapMeter(data as MeterRow);
}

export async function deleteMeterById(meterId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("meters").delete().eq("id", meterId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncClientMetersInDb(
  clientId: string,
  meterIds: string[],
): Promise<void> {
  const supabase = createAdminClient();
  const uniqueMeterIds = [...new Set(meterIds)];

  const { data: currentMeters, error: listError } = await supabase
    .from("meters")
    .select("id")
    .eq("client_id", clientId);

  if (listError) {
    throw new Error(listError.message);
  }

  const currentIds = (currentMeters ?? []).map((row) => row.id);
  const detachIds = currentIds.filter((id) => !uniqueMeterIds.includes(id));

  if (detachIds.length > 0) {
    const { error: detachError } = await supabase
      .from("meters")
      .update({ client_id: null })
      .in("id", detachIds);

    if (detachError) {
      throw new Error(detachError.message);
    }
  }

  if (uniqueMeterIds.length > 0) {
    const { error: attachError } = await supabase
      .from("meters")
      .update({ client_id: clientId })
      .in("id", uniqueMeterIds);

    if (attachError) {
      throw new Error(attachError.message);
    }
  }
}

export async function attachMeterToClientInDb(
  meterId: string,
  clientId: string | null,
): Promise<void> {
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("meters")
    .update({ client_id: clientId })
    .eq("id", meterId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
