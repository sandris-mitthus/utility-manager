import { findClientByLookup, getCurrentMonthKey } from "@/app/lib/utility/helpers";
import {
  markEmailInboxSubmissionImportFailed,
  markEmailInboxSubmissionImported,
} from "@/app/lib/utility/email-inbox-repository";
import {
  enrichParsedEmailWithClientMeters,
  type MatchedEmailReading,
} from "@/app/lib/utility/match-parsed-email-readings";
import { upsertEmailReadingsInDb } from "@/app/lib/utility/repository";
import type {
  EmailInboxMessage,
  UtilityClient,
  UtilityMeter,
} from "@/app/lib/utility/types";

export type EmailImportReadiness =
  | { ready: false; reason: string }
  | {
      ready: true;
      client: UtilityClient;
      month: string;
      readings: Record<string, number>;
      previousReadings: Record<string, number>;
      matchedReadings: MatchedEmailReading[];
    };

export type EmailImportBatchSummary = {
  imported: number;
  skipped: number;
  failed: number;
};

function resolveSubmissionMonth(message: EmailInboxMessage): string {
  const source = message.receivedAt ?? message.fetchedAt;
  return getCurrentMonthKey(new Date(source));
}

export function evaluateEmailImportReadiness(
  message: EmailInboxMessage,
  clients: UtilityClient[],
  meters: UtilityMeter[],
): EmailImportReadiness {
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

export async function importEmailInboxMessageToSubmissions(
  message: EmailInboxMessage,
  clients: UtilityClient[],
  meters: UtilityMeter[],
): Promise<"imported" | "skipped" | "failed"> {
  const readiness = evaluateEmailImportReadiness(message, clients, meters);

  if (!readiness.ready) {
    if (readiness.reason === "already_imported") {
      return "skipped";
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

    await markEmailInboxSubmissionImported(message.id, {
      clientId: readiness.client.id,
      month: readiness.month,
    });

    return "imported";
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Neizdevās importēt rādījumus.";
    await markEmailInboxSubmissionImportFailed(message.id, reason);
    return "failed";
  }
}

export async function importPendingEmailInboxSubmissions(
  messages: EmailInboxMessage[],
  clients: UtilityClient[],
  meters: UtilityMeter[],
  batchSize = 30,
): Promise<EmailImportBatchSummary> {
  const summary: EmailImportBatchSummary = {
    imported: 0,
    skipped: 0,
    failed: 0,
  };

  const pending = messages
    .filter((message) => !message.submissionImportedAt)
    .slice(0, batchSize);

  for (const message of pending) {
    const result = await importEmailInboxMessageToSubmissions(message, clients, meters);
    summary[result] += 1;
  }

  return summary;
}

export async function runEmailInboxImportPipeline(batchSize = 30): Promise<EmailImportBatchSummary> {
  const { loadUtilityAdminState } = await import("@/app/lib/utility/repository");
  const { listEmailInboxMessages } = await import("@/app/lib/utility/email-inbox-repository");

  const [state, messages] = await Promise.all([
    loadUtilityAdminState(),
    listEmailInboxMessages(100),
  ]);

  return importPendingEmailInboxSubmissions(
    messages,
    state.clients,
    state.meters,
    batchSize,
  );
}
