import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import { isContactEmailTransportConfigured } from "@/app/lib/utility/email-password";
import type {
  AdminContactSettings,
  MeterType,
  PublicContactSettings,
  PublicLookupResult,
  UtilityClient,
  UtilityMeter,
  UtilityState,
  UtilitySubmission,
} from "@/app/lib/utility/types";
import { createLookupSubmissionToken } from "@/app/lib/security/lookup-token";
import { findClientByLookup, getCurrentMonthKey } from "@/app/lib/utility/helpers";

type ClientRow = {
  id: string;
  client_number: string;
  address: string;
};

type MeterRow = {
  id: string;
  number: string;
  type: MeterType;
  verification_date: string;
  client_id: string | null;
  location: string;
  previous_reading: number | string;
};

type ContactSettingsRow = {
  email: string;
  sms_number: string;
  whatsapp_number: string;
  phone_number: string;
};

type SubmissionRow = {
  client_id: string;
  month: string;
  submitted_at: string;
  readings: Record<string, number> | string;
};

function requireDb() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase nav konfigurēts. Pievienojiet vides mainīgos.");
  }
}

function mapPublicSettings(row: ContactSettingsRow): PublicContactSettings {
  return {
    email: row.email,
    smsNumber: row.sms_number,
    whatsappNumber: row.whatsapp_number,
    phoneNumber: row.phone_number,
  };
}

function mapAdminSettings(row: ContactSettingsRow): AdminContactSettings {
  return {
    ...mapPublicSettings(row),
    emailPasswordConfigured: isContactEmailTransportConfigured(),
  };
}

function mapMeter(row: MeterRow): UtilityMeter {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    verificationDate: row.verification_date,
    clientId: row.client_id ?? "",
    location: row.location,
    previousReading: Number(row.previous_reading),
  };
}

function attachMeterIds(clients: ClientRow[], meters: UtilityMeter[]): UtilityClient[] {
  return clients.map((client) => ({
    id: client.id,
    clientNumber: client.client_number,
    address: client.address,
    meterIds: meters.filter((meter) => meter.clientId === client.id).map((meter) => meter.id),
  }));
}

function mapSubmission(row: SubmissionRow): UtilitySubmission {
  const readings =
    typeof row.readings === "string"
      ? (JSON.parse(row.readings) as Record<string, number>)
      : row.readings;

  return {
    clientId: row.client_id,
    month: row.month,
    submittedAt: row.submitted_at,
    readings,
  };
}

async function loadCoreData(supabase: ReturnType<typeof createAdminClient>) {
  const [settingsResult, clientsResult, metersResult, submissionsResult] = await Promise.all([
    supabase
      .from("contact_settings")
      .select("email, sms_number, whatsapp_number, phone_number")
      .eq("id", 1)
      .maybeSingle(),
    supabase.from("clients").select("id, client_number, address").order("client_number"),
    supabase
      .from("meters")
      .select("id, number, type, verification_date, client_id, location, previous_reading")
      .order("number"),
    supabase
      .from("readings_submissions")
      .select("client_id, month, submitted_at, readings")
      .order("submitted_at", { ascending: false }),
  ]);

  if (
    settingsResult.error ||
    clientsResult.error ||
    metersResult.error ||
    submissionsResult.error
  ) {
    throw new Error(
      settingsResult.error?.message ||
        clientsResult.error?.message ||
        metersResult.error?.message ||
        submissionsResult.error?.message ||
        "Failed to load utility data",
    );
  }

  const meters = (metersResult.data as MeterRow[]).map(mapMeter);
  const clients = attachMeterIds(clientsResult.data as ClientRow[], meters);
  const submissions = (submissionsResult.data as SubmissionRow[]).map(mapSubmission);

  const settingsRow = settingsResult.data as ContactSettingsRow | null;
  if (!settingsRow) {
    throw new Error("Kontaktu iestatījumi nav atrasti.");
  }

  return { clients, meters, submissions, settingsRow };
}

export async function loadPublicContactSettings(): Promise<PublicContactSettings> {
  requireDb();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contact_settings")
    .select("email, sms_number, whatsapp_number, phone_number")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Kontaktu iestatījumi nav atrasti.");
  }

  return mapPublicSettings(data as ContactSettingsRow);
}

export async function lookupPublicClientInDb(query: string): Promise<PublicLookupResult | null> {
  requireDb();
  const supabase = createAdminClient();

  const [clientsResult, metersResult] = await Promise.all([
    supabase.from("clients").select("id, client_number, address").order("client_number"),
    supabase
      .from("meters")
      .select("id, number, type, verification_date, client_id, location, previous_reading")
      .order("number"),
  ]);

  if (clientsResult.error || metersResult.error) {
    throw new Error(clientsResult.error?.message || metersResult.error?.message || "Lookup failed");
  }

  const meters = (metersResult.data as MeterRow[]).map(mapMeter);
  const clients = attachMeterIds(clientsResult.data as ClientRow[], meters);
  const client = findClientByLookup(clients, query);
  if (!client) {
    return null;
  }

  const clientMeters = meters.filter((meter) => meter.clientId === client.id);
  const month = getCurrentMonthKey();
  const { data: existingSubmission, error: submissionError } = await supabase
    .from("readings_submissions")
    .select("id")
    .eq("client_id", client.id)
    .eq("month", month)
    .maybeSingle();

  if (submissionError) {
    throw new Error(submissionError.message);
  }

  return {
    client,
    meters: clientMeters,
    hasSubmissionThisMonth: Boolean(existingSubmission),
    submissionToken: createLookupSubmissionToken(client.id),
  };
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

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("id, client_number, address")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    throw new Error(clientError.message);
  }

  if (!clientRow) {
    return { ok: false, status: 404, message: "Klients nav atrasts." };
  }

  const { data: meterRows, error: metersError } = await supabase
    .from("meters")
    .select("id, number, type, verification_date, client_id, location, previous_reading")
    .eq("client_id", clientId);

  if (metersError) {
    throw new Error(metersError.message);
  }

  const meters = (meterRows as MeterRow[]).map(mapMeter);
  if (meters.length === 0) {
    return { ok: false, status: 400, message: "Klientam nav piesaistītu skaitītāju." };
  }

  const { data: existingSubmission, error: submissionError } = await supabase
    .from("readings_submissions")
    .select("id")
    .eq("client_id", clientId)
    .eq("month", month)
    .maybeSingle();

  if (submissionError) {
    throw new Error(submissionError.message);
  }

  if (existingSubmission) {
    return { ok: false, status: 409, message: "Rādījumi šim mēnesim jau ir iesniegti." };
  }

  for (const meter of meters) {
    const current = readings[meter.id];
    if (current === undefined) {
      return {
        ok: false,
        status: 400,
        message: `Ievadiet rādījumu visiem skaitītājiem (${meter.number}).`,
      };
    }
    if (current < meter.previousReading) {
      return {
        ok: false,
        status: 400,
        message: `Skaitītājam ${meter.number} rādījums nevar būt mazāks par iepriekšējo periodu.`,
      };
    }
  }

  return {
    ok: true,
    month,
    client: {
      id: clientRow.id,
      clientNumber: clientRow.client_number,
      address: clientRow.address,
      meterIds: meters.map((meter) => meter.id),
    },
    meters,
    readings,
  };
}

export async function loadUtilityAdminState(): Promise<UtilityState> {
  requireDb();
  const supabase = createAdminClient();
  const { clients, meters, submissions, settingsRow } = await loadCoreData(supabase);

  return {
    clients,
    meters,
    submissions,
    settings: mapAdminSettings(settingsRow),
  };
}

export async function updateContactSettings(
  settings: PublicContactSettings,
): Promise<AdminContactSettings> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contact_settings")
    .update({
      email: settings.email,
      sms_number: settings.smsNumber,
      whatsapp_number: settings.whatsappNumber,
      phone_number: settings.phoneNumber,
    })
    .eq("id", 1)
    .select("email, sms_number, whatsapp_number, phone_number")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update settings");
  }

  return mapAdminSettings(data as ContactSettingsRow);
}

export async function submitReadingsInDb(
  clientId: string,
  month: string,
  readings: Record<string, number>,
): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("readings_submissions")
    .select("id")
    .eq("client_id", clientId)
    .eq("month", month)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    throw new Error("Rādījumi šim mēnesim jau ir iesniegti.");
  }

  const { error: insertError } = await supabase.from("readings_submissions").insert({
    client_id: clientId,
    month,
    readings,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  for (const [meterId, reading] of Object.entries(readings)) {
    const { error: meterError } = await supabase
      .from("meters")
      .update({ previous_reading: reading })
      .eq("id", meterId)
      .eq("client_id", clientId);

    if (meterError) {
      throw new Error(meterError.message);
    }
  }
}

export async function upsertClient(client: UtilityClient): Promise<UtilityClient> {
  const supabase = createAdminClient();
  const payload = {
    id: client.id,
    client_number: client.clientNumber.trim(),
    address: client.address.trim(),
  };

  const { data, error } = await supabase
    .from("clients")
    .upsert(payload)
    .select("id, client_number, address")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save client");
  }

  return {
    id: data.id,
    clientNumber: data.client_number,
    address: data.address,
    meterIds: client.meterIds,
  };
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
  const payload = {
    id: meter.id,
    number: meter.number.trim(),
    type: meter.type,
    verification_date: meter.verificationDate,
    client_id: meter.clientId || null,
    location: meter.location.trim(),
    previous_reading: meter.previousReading,
  };

  const { data, error } = await supabase
    .from("meters")
    .upsert(payload)
    .select("id, number, type, verification_date, client_id, location, previous_reading")
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
