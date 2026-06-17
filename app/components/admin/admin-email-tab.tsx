"use client";

import { useMemo, useState } from "react";
import { useAdminData, findAdminClient } from "@/app/components/admin-data-provider";
import {
  FeedbackToast,
  type FeedbackToastVariant,
} from "@/app/components/ui/feedback-toast";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import {
  cardClassName,
  statusBadgeClassName,
  tableClassName,
} from "@/app/components/ui/form-styles";
import { IconMail, IconRefresh, IconTrash } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { adminMutationHeaders } from "@/app/lib/security/admin-api";
import { runPendingAction } from "@/app/lib/run-pending-action";
import { formatDateTimeDisplay } from "@/app/lib/format-date";
import { formatMonthLabel, formatReading } from "@/app/lib/utility/helpers";
import {
  enrichParsedEmailWithClientMeters,
  formatMatchedReadingSummary,
} from "@/app/lib/utility/match-parsed-email-readings";
import type { EmailFetchState, EmailInboxMessage } from "@/app/lib/utility/types";

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

type InboxResponse = {
  success: boolean;
  message?: string;
  data?: {
    messages: EmailInboxMessage[];
    fetchState: EmailFetchState;
    summary?: {
      fetchedCount: number;
      newCount: number;
    };
    reparsedCount?: number;
    importSummary?: {
      imported: number;
      skipped: number;
      failed: number;
    };
  };
};

const MATCH_METHOD_LABELS = {
  meter_number: "Skaitītāja nr.",
  label_type_location: "Tips + vieta",
  label_type: "Tips",
  previous_reading: "Iepriekšējais rādījums",
  value_increase: "Pieaugums pret iepriekšējo",
  closest_baseline: "Tuvākais iepriekšējais",
  none: "Nav piesaistīts",
} as const;

const PARSE_STATUS_LABELS: Record<EmailInboxMessage["parseStatus"], string> = {
  parsed: "Parsēts",
  partial: "Daļēji",
  failed: "Neizdevās",
  pending: "Gaida",
};

type AdminEmailTabProps = {
  initialInbox: {
    messages: EmailInboxMessage[];
    fetchState: EmailFetchState;
  } | null;
};

export function AdminEmailTab({ initialInbox }: AdminEmailTabProps) {
  const { state, reloadState } = useAdminData();
  const [messages, setMessages] = useState<EmailInboxMessage[]>(initialInbox?.messages ?? []);
  const [fetchState, setFetchState] = useState<EmailFetchState | null>(
    initialInbox?.fetchState ?? null,
  );
  const [pendingAction, setPendingAction] = useState<"fetch" | "reparse" | "delete" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<EmailInboxMessage | null>(null);

  const inboxConfigured = state.settings.emailInboxConfigured;

  const rows = useMemo(() => {
    return messages.map((message) => {
      const lookupQuery = message.parsed.clientNumber || message.parsed.addressHint || "";
      const matchedClient = lookupQuery ? findAdminClient(state, lookupQuery) : null;
      const enriched = enrichParsedEmailWithClientMeters(
        message.parsed,
        matchedClient,
        state.meters,
      );

      return {
        message,
        matchedClient,
        enriched,
      };
    });
  }, [messages, state]);

  async function applyInboxResponse(json: InboxResponse) {
    if (!json.data) {
      return;
    }

    setMessages(json.data.messages);
    setFetchState(json.data.fetchState);

    if ((json.data.importSummary?.imported ?? 0) > 0) {
      await reloadState();
    }
  }

  async function handleFetch() {
    await runPendingAction("fetch", setPendingAction, async () => {
      const response = await fetch("/api/admin/email/inbox", {
        method: "POST",
        headers: adminMutationHeaders(),
      });
      const json = (await response.json()) as InboxResponse;

      if (!response.ok || !json.success || !json.data) {
        setFeedback({
          message: json.message || "Neizdevās ievākt e-pastus.",
          variant: "error",
        });
        return;
      }

      await applyInboxResponse(json);

      const newCount = json.data.summary?.newCount ?? 0;
      const importedCount = json.data.importSummary?.imported ?? 0;
      setFeedback({
        message:
          importedCount > 0
            ? `Ievākti ${newCount} jauni e-pasti. ${importedCount} pievienoti nodotajiem rādījumiem.`
            : newCount > 0
              ? `Ievākti ${newCount} jauni e-pasti.`
              : "Jaunu e-pastu nav. Pēdējā pārbaude pabeigta.",
        variant: "success",
      });
    });
  }

  async function handleReparse() {
    await runPendingAction("reparse", setPendingAction, async () => {
      const response = await fetch("/api/admin/email/inbox?action=reparse", {
        method: "POST",
        headers: adminMutationHeaders(),
      });
      const json = (await response.json()) as InboxResponse;

      if (!response.ok || !json.success || !json.data) {
        setFeedback({
          message: json.message || "Neizdevās pārparsēt e-pastus.",
          variant: "error",
        });
        return;
      }

      await applyInboxResponse(json);

      const importedCount = json.data.importSummary?.imported ?? 0;
      setFeedback({
        message:
          importedCount > 0
            ? `Pārparsēti ${json.data.reparsedCount ?? 0} ieraksti. ${importedCount} pievienoti nodotajiem rādījumiem.`
            : `Pārparsēti ${json.data.reparsedCount ?? 0} e-pasta ieraksti.`,
        variant: "success",
      });
    });
  }

  async function confirmDeleteMessage() {
    if (!messageToDelete) {
      return;
    }

    await runPendingAction("delete", setPendingAction, async () => {
      const response = await fetch(
        `/api/admin/email/inbox?id=${encodeURIComponent(messageToDelete.id)}`,
        {
          method: "DELETE",
          headers: adminMutationHeaders(),
        },
      );
      const json = (await response.json()) as InboxResponse;

      if (!response.ok || !json.success || !json.data) {
        setFeedback({
          message: json.message || "Neizdevās dzēst e-pasta ierakstu.",
          variant: "error",
        });
        return;
      }

      setMessages(json.data.messages);
      setFetchState(json.data.fetchState);
      setMessageToDelete(null);
      if (expandedId === messageToDelete.id) {
        setExpandedId(null);
      }
      setFeedback({ message: "E-pasta ieraksts dzēsts.", variant: "success" });
    });
  }

  const isBusy = pendingAction !== null;

  return (
    <>
      <div className={`${cardClassName} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">E-pasta rādījumi</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Sistēma pārbauda iesūtni reizi stundā un ievāk tikai nelasītos e-pastus. Pēc
              veiksmīgas parsēšanas rādījumi automātiski nonāk sadaļā „Rādījumi”.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              type="button"
              variant="secondary"
              loading={pendingAction === "reparse"}
              disabled={isBusy || messages.length === 0}
              icon={<IconMail />}
              onClick={() => void handleReparse()}
            >
              Pārparsēt tekstu
            </ActionButton>
            <ActionButton
              type="button"
              variant="primary"
              loading={pendingAction === "fetch"}
              disabled={!inboxConfigured || isBusy}
              icon={<IconRefresh />}
              onClick={() => void handleFetch()}
            >
              Ievākt datus no e-pasta
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            <p className="font-medium text-zinc-800">IMAP statuss</p>
            <p className="mt-1">
              {inboxConfigured
                ? `Konfigurēts (${state.settings.email}${state.settings.imapHost ? ` · ${state.settings.imapHost}` : ""})`
                : "Nav konfigurēts. Iestatījumos norādiet e-pastu, paroli un IMAP serveri."}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            <p className="font-medium text-zinc-800">Pēdējā pārbaude</p>
            <p className="mt-1">
              {fetchState?.lastFetchAt
                ? formatDateTimeDisplay(fetchState.lastFetchAt)
                : "Vēl nav veikta"}
            </p>
            {fetchState?.lastFetchStatus === "error" && fetchState.lastError ? (
              <p className="mt-1 text-red-600">{fetchState.lastError}</p>
            ) : null}
          </div>
        </div>
      </div>

      <section className={cardClassName}>
        <div className="flex items-center gap-2">
          <IconMail className="size-4 text-zinc-500" />
          <h3 className="text-base font-semibold text-zinc-900">Ievāktie e-pasti</h3>
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Vēl nav ievākts neviens e-pasts. Nospiediet „Ievākt datus no e-pasta”.
          </p>
        ) : (
          <div className="mt-4">
            <table className={`${tableClassName} w-full table-fixed`}>
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="w-36 px-3 py-2 font-medium">Saņemts</th>
                  <th className="px-3 py-2 font-medium">Tēma / sūtītājs</th>
                  <th className="w-48 px-3 py-2 font-medium">Klients</th>
                  <th className="px-3 py-2 font-medium">Rādījumi</th>
                  <th className="w-14 px-3 py-2 font-medium">Darbības</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map(({ message, matchedClient, enriched }) => (
                  <tr key={message.id} className="align-top text-zinc-800">
                    <td className="px-3 py-3 text-sm whitespace-nowrap">
                      {message.receivedAt
                        ? formatDateTimeDisplay(message.receivedAt)
                        : formatDateTimeDisplay(message.fetchedAt)}
                    </td>
                    <td className="min-w-0 px-3 py-3">
                      <button
                        type="button"
                        className={`w-full text-left ${message.submissionImportedAt ? "" : ""}`}
                        onClick={() => {
                          if (message.submissionImportedAt) {
                            return;
                          }
                          setExpandedId((current) =>
                            current === message.id ? null : message.id,
                          );
                        }}
                      >
                        <p className="font-medium break-words text-zinc-900">
                          {message.subject || "(bez tēmas)"}
                        </p>
                        <p className="mt-1 break-all text-xs text-zinc-500">
                          {message.fromAddress || "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={statusBadgeClassName(message.parseStatus === "parsed")}>
                            {PARSE_STATUS_LABELS[message.parseStatus]}
                          </span>
                          {message.submissionImportedAt ? (
                            <span className={statusBadgeClassName(true)}>
                              Pievienots nodotajiem rādījumiem
                              {message.submissionMonth
                                ? ` · ${formatMonthLabel(message.submissionMonth)}`
                                : ""}
                            </span>
                          ) : null}
                          {!message.submissionImportedAt ? (
                            <span className="text-xs text-zinc-500">
                              Uzticamība: {message.parsed.confidence}
                            </span>
                          ) : null}
                        </div>
                      </button>
                      {message.submissionImportedAt ? null : expandedId === message.id ? (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">
                          {message.bodyText || message.subject}
                        </pre>
                      ) : null}
                      {message.submissionImportError && !message.submissionImportedAt ? (
                        <p className="mt-2 text-xs text-red-600">{message.submissionImportError}</p>
                      ) : null}
                    </td>
                    <td className="min-w-0 px-3 py-3 text-sm">
                      {matchedClient ? (
                        <>
                          <p className="font-medium">{matchedClient.clientNumber}</p>
                          <p className="mt-1 break-words text-xs text-zinc-600">
                            {matchedClient.address}
                          </p>
                        </>
                      ) : (
                        <>
                          {message.parsed.clientNumber ? (
                            <p className="font-medium">Nr. {message.parsed.clientNumber}</p>
                          ) : null}
                          {message.parsed.addressHint ? (
                            <p
                              className={`break-words text-xs text-zinc-500 ${message.parsed.clientNumber ? "mt-1" : ""}`}
                            >
                              {message.parsed.addressHint}
                            </p>
                          ) : null}
                          <p
                            className={`text-xs text-amber-700 ${
                              message.parsed.clientNumber || message.parsed.addressHint ? "mt-1" : ""
                            }`}
                          >
                            Nav atrasts DB
                          </p>
                        </>
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-3">
                      {enriched.matchedReadings.length === 0 ? (
                        <p className="text-xs text-zinc-500">Nav</p>
                      ) : (
                        <ul className="space-y-2 text-xs">
                          {enriched.matchedReadings.map((match, index) => (
                            <li
                              key={`${message.id}-match-${index}`}
                              className={
                                match.meterId
                                  ? match.isValidReading
                                    ? "text-emerald-800"
                                    : "text-red-700"
                                  : "text-amber-700"
                              }
                            >
                              <p className="break-words font-medium text-zinc-900">
                                {formatMatchedReadingSummary(match)}
                              </p>
                              <p className="break-words">
                                {match.baselineReading !== null
                                  ? `${formatReading(match.baselineReading)} → ${formatReading(match.source.currentValue)}`
                                  : formatReading(match.source.currentValue)}
                                {match.consumption !== null
                                  ? ` · patēriņš ${formatReading(match.consumption)} m³`
                                  : ""}
                              </p>
                              <p className="text-zinc-500">
                                {MATCH_METHOD_LABELS[match.matchMethod]}
                                {match.source.label ? ` · no teksta: ${match.source.label}` : ""}
                              </p>
                              {match.notes.map((note) => (
                                <p key={note} className="text-amber-700">
                                  {note}
                                </p>
                              ))}
                            </li>
                          ))}
                        </ul>
                      )}
                      {enriched.warnings.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-amber-700">
                          {enriched.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TooltipIconButton
                        tooltip="Dzēst e-pasta ierakstu"
                        icon={<IconTrash className="size-4" />}
                        variant="danger"
                        onClick={() => setMessageToDelete(message)}
                        disabled={isBusy}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {messageToDelete ? (
        <ConfirmCloseDialog
          title="Dzēst e-pasta ierakstu?"
          message={`Vai tiešām vēlaties dzēst ierakstu no ${messageToDelete.fromAddress || "nezināms sūtītājs"} (${messageToDelete.subject || "bez tēmas"})? Šo darbību nevar atsaukt.`}
          confirmLabel="Dzēst"
          confirmVariant="danger"
          onConfirm={confirmDeleteMessage}
          onCancel={() => setMessageToDelete(null)}
        />
      ) : null}

      {feedback ? (
        <FeedbackToast
          message={feedback.message}
          variant={feedback.variant}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}
    </>
  );
}
