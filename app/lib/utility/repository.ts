import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import { DEMO_SEED } from "@/app/lib/demo/seed-data";
import type {
  DemoClient,
  DemoContactSettings,
  DemoDataState,
  DemoMeter,
  MeterType,
} from "@/app/lib/demo/types";

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
  email_password: string;
  sms_number: string;
  whatsapp_number: string;
  phone_number: string;
};

function mapSettings(row: ContactSettingsRow): DemoContactSettings {
  return {
    email: row.email,
    emailPassword: row.email_password,
    smsNumber: row.sms_number,
    whatsappNumber: row.whatsapp_number,
    phoneNumber: row.phone_number,
  };
}

function mapMeter(row: MeterRow): DemoMeter {
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

function attachMeterIds(clients: ClientRow[], meters: DemoMeter[]): DemoClient[] {
  return clients.map((client) => ({
    id: client.id,
    clientNumber: client.client_number,
    address: client.address,
    meterIds: meters.filter((meter) => meter.clientId === client.id).map((meter) => meter.id),
  }));
}

export async function loadContactSettings(): Promise<DemoContactSettings> {
  if (!isSupabaseAdminConfigured()) {
    return DEMO_SEED.settings;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contact_settings")
    .select("email, email_password, sms_number, whatsapp_number, phone_number")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapSettings(data as ContactSettingsRow) : DEMO_SEED.settings;
}

export async function loadUtilityAdminState(): Promise<DemoDataState> {
  if (!isSupabaseAdminConfigured()) {
    return DEMO_SEED;
  }

  const supabase = createAdminClient();

  const [settingsResult, clientsResult, metersResult] = await Promise.all([
    supabase.from("contact_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("clients").select("id, client_number, address").order("client_number"),
    supabase
      .from("meters")
      .select("id, number, type, verification_date, client_id, location, previous_reading")
      .order("number"),
  ]);

  if (settingsResult.error || clientsResult.error || metersResult.error) {
    throw new Error(
      settingsResult.error?.message ||
        clientsResult.error?.message ||
        metersResult.error?.message ||
        "Failed to load utility data",
    );
  }

  const meters = (metersResult.data as MeterRow[]).map(mapMeter);
  const clients = attachMeterIds(clientsResult.data as ClientRow[], meters);

  return {
    settings: settingsResult.data
      ? mapSettings(settingsResult.data as ContactSettingsRow)
      : DEMO_SEED.settings,
    clients,
    meters,
    submissions: [],
  };
}

export async function updateContactSettings(
  settings: DemoContactSettings,
): Promise<DemoContactSettings> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contact_settings")
    .update({
      email: settings.email,
      email_password: settings.emailPassword,
      sms_number: settings.smsNumber,
      whatsapp_number: settings.whatsappNumber,
      phone_number: settings.phoneNumber,
    })
    .eq("id", 1)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update settings");
  }

  return mapSettings(data as ContactSettingsRow);
}

export async function upsertClient(client: DemoClient): Promise<DemoClient> {
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

export async function upsertMeter(meter: DemoMeter): Promise<DemoMeter> {
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
