import { randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { VOICE_AGENT_INTEGRATION_KEY } from "@/app/lib/utility/voice-agent-tools";
import { METER_TYPE_LABELS } from "@/app/lib/utility/helpers";
import { getReadingWindowStatus, readingWindowClosedMessage } from "@/app/lib/utility/reading-window";
import {
  loadPublicContactSettings,
  lookupPublicClientInDb,
  submitReadingsInDb,
  validatePublicSubmissionInDb,
} from "@/app/lib/utility/repository";
import type { UtilityClient, UtilityMeter } from "@/app/lib/utility/types";

export { VOICE_AGENT_TOOLSET } from "@/app/lib/utility/voice-agent-tools";

export type VoiceAgentAccess = { key: string; enabled: boolean };

function newKey() {
  return randomBytes(32).toString("hex");
}

export async function loadVoiceAgentAccess(): Promise<VoiceAgentAccess> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_integrations")
    .select("client_secret, is_enabled")
    .eq("integration_key", VOICE_AGENT_INTEGRATION_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.client_secret) return { key: String(data.client_secret), enabled: Boolean(data.is_enabled) };
  return rotateVoiceAgentKey();
}

async function saveVoiceAgentAccess(patch: { client_secret?: string; is_enabled?: boolean }): Promise<VoiceAgentAccess> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_integrations")
    .upsert({ integration_key: VOICE_AGENT_INTEGRATION_KEY, is_configured: true, ...patch }, { onConflict: "integration_key" })
    .select("client_secret, is_enabled")
    .single();
  if (error) throw new Error(error.message);
  return { key: String(data.client_secret ?? ""), enabled: Boolean(data.is_enabled) };
}

export async function rotateVoiceAgentKey() {
  return saveVoiceAgentAccess({ client_secret: newKey() });
}

export async function setVoiceAgentEnabled(enabled: boolean) {
  return saveVoiceAgentAccess({ is_enabled: enabled });
}

export async function isVoiceAgentKey(header: string | null): Promise<boolean> {
  const given = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!given) return false;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_integrations")
    .select("client_secret, is_enabled")
    .eq("integration_key", VOICE_AGENT_INTEGRATION_KEY)
    .maybeSingle();
  if (error || !data?.is_enabled) return false;
  const expected = String(data.client_secret ?? "");
  if (!expected || expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

function spokenMeter(meter: UtilityMeter, submitted: Record<string, number>) {
  return {
    meter: meter.number,
    type: METER_TYPE_LABELS[meter.type] ?? meter.type,
    location: meter.location,
    previous_reading: meter.previousReading,
    submitted_this_month: submitted[meter.id] !== undefined,
  };
}

export async function findClientForAgent(clientNumber: string) {
  const found = clientNumber.trim() ? await lookupPublicClientInDb(clientNumber) : null;
  if (!found) return { found: false, message: "Klients ar šo numuru nav atrasts." };
  const settings = await loadPublicContactSettings();
  const window = getReadingWindowStatus(settings.readingWindowDays);
  return {
    found: true,
    client_number: found.client.clientNumber,
    address: found.client.address,
    reading_window_open: window.open,
    message: window.open ? "" : readingWindowClosedMessage(window),
    all_submitted: found.hasSubmissionThisMonth,
    meters: found.meters.map((meter) => spokenMeter(meter, found.submittedReadings)),
  };
}

export type AgentSubmission =
  | { ok: false; message: string }
  | { ok: true; message: string; month: string; client: UtilityClient; meter: UtilityMeter; reading: number };

export async function submitReadingForAgent(clientNumber: string, meterNumber: string, reading: number): Promise<AgentSubmission> {
  const found = clientNumber.trim() ? await lookupPublicClientInDb(clientNumber) : null;
  if (!found) return { ok: false, message: "Klients ar šo numuru nav atrasts." };
  const wanted = meterNumber.replace(/\s+/g, "").toLowerCase();
  const meter = found.meters.find((item) => item.number.replace(/\s+/g, "").toLowerCase() === wanted);
  if (!meter) return { ok: false, message: "Šis skaitītājs nepieder klientam." };
  if (!Number.isFinite(reading) || reading < 0) return { ok: false, message: "Rādījums nav derīgs skaitlis." };

  const validation = await validatePublicSubmissionInDb(found.client.id, { [meter.id]: reading });
  if (!validation.ok) return { ok: false, message: validation.message };
  const accepted = validation.readings[meter.id];
  if (accepted === undefined) return { ok: false, message: "Šī skaitītāja rādījums jau ir iesniegts." };

  await submitReadingsInDb(
    found.client.id,
    validation.month,
    validation.readings,
    { [meter.id]: meter.previousReading },
    { client: validation.client, meters: validation.meters },
    true,
  );
  return { ok: true, message: "Rādījums saglabāts.", month: validation.month, client: validation.client, meter, reading: accepted };
}
