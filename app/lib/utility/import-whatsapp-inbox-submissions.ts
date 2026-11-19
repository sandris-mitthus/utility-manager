import { findClientByLookup, getCurrentMonthKey } from "@/app/lib/utility/helpers";
import {
  enrichParsedEmailWithClientMeters,
  type MatchedEmailReading,
} from "@/app/lib/utility/match-parsed-email-readings";
import { phonesMatch } from "@/app/lib/utility/normalize-phone";
import { upsertEmailReadingsInDb } from "@/app/lib/utility/repository";
import {
  markWhatsappInboxSubmissionImportFailed,
  markWhatsappInboxSubmissionImported,
} from "@/app/lib/utility/whatsapp-inbox-repository";
import type {
  UtilityClient,
  UtilityMeter,
  WhatsappInboxMessage,
} from "@/app/lib/utility/types";

export type WhatsappImportReadiness =
  | { ready: false; reason: string }
  | {
      ready: true;
      client: UtilityClient;
      month: string;
      readings: Record<string, number>;
      previousReadings: Record<string, number>;
      matchedReadings: MatchedEmailReading[];
    };

export type WhatsappImportBatchSummary = {
  imported: number;
  skipped: number;
  failed: number;
};

const IMPORT_REASON_LABELS: Record<string, string> = {
  already_imported: "Jau importēts",
  parse_incomplete: "Ziņa nav pilnībā parsēta",
  no_client_lookup: "Nav klienta koda ziņā",
  client_not_found: "Klients nav atrasts",
  phone_mismatch: "WhatsApp numurs nesakrīt ar klienta telefonu",
  no_readings: "Nav atrasti rādījumi",
  unmatched_readings: "Rādījumi nav sasaistīti ar skaitītājiem",
  invalid_readings: "Nederīgi rādījumi",
};

export function whatsappImportReasonLabel(reason: string): string {
  return IMPORT_REASON_LABELS[reason] ?? reason;
}

function resolveSubmissionMonth(message: WhatsappInboxMessage): string {
  const source = message.receivedAt ?? message.fetchedAt;
  return getCurrentMonthKey(new Date(source));
}

export function evaluateWhatsappImportReadiness(
  message: WhatsappInboxMessage,
  clients: UtilityClient[],
  meters: UtilityMeter[],
): WhatsappImportReadiness {
  if (message.submissionImportedAt) {
    return { ready: false, reason: "already_imported" };
  }

  if (message.parseStatus !== "parsed") {
    return { ready: false, reason: "parse_incomplete" };
  }

  const lookupQuery = message.parsed.clientNumber || message.parsed.addressHint || "";
  if (!lookupQuery) {
    return { ready: false, reason: "no_client_lookup" };
  }

  const client = findClientByLookup(clients, lookupQuery);
  if (!client) {
    return { ready: false, reason: "client_not_found" };
  }

  const storedPhone = client.phone.trim();
  if (storedPhone && !phonesMatch(storedPhone, message.fromWaId)) {
    return { ready: false, reason: "phone_mismatch" };
  }

  const enriched = enrichParsedEmailWithClientMeters(message.parsed, client, meters);

  if (enriched.readings.length === 0) {
    return { ready: false, reason: "no_readings" };
  }

  if (enriched.matchedReadings.length !== enriched.readings.length) {
    return { ready: false, reason: "unmatched_readings" };
  }

  const invalid = enriched.matchedReadings.filter(
    (item) => !item.meterId || !item.isValidReading,
  );
  if (invalid.length > 0) {
    return { ready: false, reason: "invalid_readings" };
  }

  const readings: Record<string, number> = {};
  const previousReadings: Record<string, number> = {};

  for (const match of enriched.matchedReadings) {
    if (!match.meterId || match.baselineReading === null) {
      return { ready: false, reason: "invalid_readings" };
    }

    readings[match.meterId] = match.source.currentValue;
    previousReadings[match.meterId] = match.baselineReading;
  }

  return {
    ready: true,
    client,
    month: resolveSubmissionMonth(message),
    readings,
    previousReadings,
    matchedReadings: enriched.matchedReadings,
  };
}

export async function importWhatsappInboxMessageToSubmissions(
  message: WhatsappInboxMessage,
  clients: UtilityClient[],
  meters: UtilityMeter[],
): Promise<"imported" | "skipped" | "failed"> {
  const readiness = evaluateWhatsappImportReadiness(message, clients, meters);

  if (!readiness.ready) {
    if (readiness.reason === "already_imported") {
      return "skipped";
    }

    if (
      readiness.reason === "phone_mismatch" ||
      readiness.reason === "client_not_found" ||
      readiness.reason === "no_client_lookup" ||
      readiness.reason === "invalid_readings" ||
      readiness.reason === "unmatched_readings" ||
      readiness.reason === "no_readings" ||
      readiness.reason === "parse_incomplete"
    ) {
      await markWhatsappInboxSubmissionImportFailed(
        message.id,
        whatsappImportReasonLabel(readiness.reason),
      );
    }

    return "skipped";
  }

  try {
    await upsertEmailReadingsInDb(
      readiness.client.id,
      readiness.month,
      readiness.readings,
      readiness.previousReadings,
    );

    await markWhatsappInboxSubmissionImported(message.id, {
      clientId: readiness.client.id,
      month: readiness.month,
    });

    return "imported";
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Neizdevās importēt rādījumus.";
    await markWhatsappInboxSubmissionImportFailed(message.id, reason);
    return "failed";
  }
}

export async function importPendingWhatsappInboxSubmissions(
  messages: WhatsappInboxMessage[],
  clients: UtilityClient[],
  meters: UtilityMeter[],
  batchSize = 30,
): Promise<WhatsappImportBatchSummary> {
  const summary: WhatsappImportBatchSummary = {
    imported: 0,
    skipped: 0,
    failed: 0,
  };

  const pending = messages
    .filter((message) => !message.submissionImportedAt)
    .slice(0, batchSize);

  for (const message of pending) {
    const result = await importWhatsappInboxMessageToSubmissions(message, clients, meters);
    summary[result] += 1;
  }

  return summary;
}

export async function runWhatsappInboxImportPipeline(
  batchSize = 30,
): Promise<WhatsappImportBatchSummary> {
  const { loadUtilityAdminState } = await import("@/app/lib/utility/repository");
  const { listWhatsappInboxMessages } = await import(
    "@/app/lib/utility/whatsapp-inbox-repository"
  );

  const [state, messages] = await Promise.all([
    loadUtilityAdminState(),
    listWhatsappInboxMessages(100),
  ]);

  return importPendingWhatsappInboxSubmissions(
    messages,
    state.clients,
    state.meters,
    batchSize,
  );
}
