"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminData } from "@/app/components/admin-data-provider";
import {
  FeedbackToast,
  type FeedbackToastVariant,
} from "@/app/components/ui/feedback-toast";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import {
  cardClassName,
  inputClassName,
  labelClassName,
  statusBadgeClassName,
  tableClassName,
} from "@/app/components/ui/form-styles";
import { IconInput, IconSelect, PasswordInput } from "@/app/components/ui/icon-input";
import {
  IconChat,
  IconHash,
  IconMessage,
  IconPhone,
  IconRefresh,
  IconSave,
  IconSend,
  IconTrash,
} from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { adminMutationHeaders } from "@/app/lib/security/admin-api";
import { runPendingAction } from "@/app/lib/run-pending-action";
import { formatDateTimeDisplay } from "@/app/lib/format-date";
import { findClientByLookup, formatMonthLabel, formatReading } from "@/app/lib/utility/helpers";
import {
  enrichParsedEmailWithClientMeters,
  formatMatchedReadingSummary,
} from "@/app/lib/utility/match-parsed-email-readings";
import { phonesMatch } from "@/app/lib/utility/normalize-phone";
import {
  WHATSAPP_MESSAGE_TEMPLATE,
  WHATSAPP_MODE_LABELS,
} from "@/app/lib/utility/whatsapp-message";
import type { AdminContactSettings, WhatsappInboxMessage, WhatsappMode } from "@/app/lib/utility/types";

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

type InboxResponse = {
  success: boolean;
  message?: string;
  data?: {
    messages: WhatsappInboxMessage[];
    webhookConfigured?: boolean;
    reparsedCount?: number;
    importSummary?: {
      imported: number;
      skipped: number;
      failed: number;
    };
  };
};

const WHATSAPP_MODE_OPTIONS: WhatsappMode[] = ["off", "link", "api"];

function whatsappStatusText(settings: AdminContactSettings): string {
  if (settings.whatsappMode === "off") {
    return "Kanāls ir izslēgts — lietotāji WhatsApp pogu neredz.";
  }

  if (settings.whatsappMode === "link") {
    return settings.whatsappNumber.trim()
      ? "Gatavs — rādījumu formā ir poga, kas atver WhatsApp sarunu ar norādīto numuru un ievieto ziņas tekstu."
      : "Norādiet WhatsApp numuru, uz kuru sūtīt ziņas.";
  }

  return settings.whatsappApiConfigured
    ? "Gatavs — rādījumi tiek nosūtīti caur WhatsApp Business API uz paziņojumu numuru."
    : "Norādiet sūtītāja numura ID, piekļuves tokenu un paziņojumu numuru.";
}

function toWhatsappDraft(settings: AdminContactSettings) {
  return {
    whatsappNumber: settings.whatsappNumber,
    whatsappMode: settings.whatsappMode,
    whatsappMessageTemplate: settings.whatsappMessageTemplate,
    whatsappPhoneNumberId: settings.whatsappPhoneNumberId,
    whatsappNotifyNumber: settings.whatsappNotifyNumber,
    whatsappTemplateName: settings.whatsappTemplateName,
    whatsappTemplateLanguage: settings.whatsappTemplateLanguage,
  };
}

const PARSE_STATUS_LABELS: Record<WhatsappInboxMessage["parseStatus"], string> = {
  parsed: "Parsēts",
  partial: "Daļēji",
  failed: "Neizdevās",
  pending: "Gaida",
};

export function AdminWhatsappTab() {
  const { state, reloadState, csrfToken, updateSettings, sendWhatsappTestMessage } = useAdminData();
  const [messages, setMessages] = useState<WhatsappInboxMessage[]>([]);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "load" | "import" | "reparse" | "delete" | "save" | "test" | null
  >(null);
  const [draft, setDraft] = useState(() => toWhatsappDraft(state.settings));
  const [whatsappTokenDraft, setWhatsappTokenDraft] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<WhatsappInboxMessage | null>(null);
  const requestedInitialLoadRef = useRef(false);

  const rows = useMemo(() => {
    return messages.map((message) => {
      const lookupQuery = message.parsed.clientNumber || message.parsed.addressHint || "";
      const matchedClient = lookupQuery ? findClientByLookup(state.clients, lookupQuery) : null;
      const enriched = enrichParsedEmailWithClientMeters(
        message.parsed,
        matchedClient,
        state.meters,
      );
      const phoneOk =
        !matchedClient?.phone.trim() || phonesMatch(matchedClient.phone, message.fromWaId);

      return {
        message,
        matchedClient,
        enriched,
        phoneOk,
      };
    });
  }, [messages, state.clients, state.meters]);

  const applyInboxResponse = useCallback(
    async (json: InboxResponse) => {
      if (!json.data) {
        return;
      }

      setMessages(json.data.messages);
      if (typeof json.data.webhookConfigured === "boolean") {
        setWebhookConfigured(json.data.webhookConfigured);
      }

      if ((json.data.importSummary?.imported ?? 0) > 0) {
        await reloadState();
      }
    },
    [reloadState],
  );

  useEffect(() => {
    if (requestedInitialLoadRef.current) {
      return;
    }

    let ignore = false;
    requestedInitialLoadRef.current = true;
    void runPendingAction("load", setPendingAction, async () => {
      const response = await fetch("/api/admin/whatsapp/inbox", {
        headers: adminMutationHeaders(csrfToken),
      });
      const json = (await response.json()) as InboxResponse;

      if (ignore) {
        return;
      }

      if (!response.ok || !json.success || !json.data) {
        setFeedback({
          message: json.message || "Neizdevās ielādēt WhatsApp datus.",
          variant: "error",
        });
        return;
      }

      await applyInboxResponse(json);
    });

    return () => {
      ignore = true;
    };
  }, [applyInboxResponse, csrfToken]);

  async function runImportBatch(successPrefix = "Importa batch pabeigts") {
    let importedCount = 0;
    let failedCount = 0;
    let importSucceeded = false;

    await runPendingAction("import", setPendingAction, async () => {
      const response = await fetch("/api/admin/whatsapp/inbox?action=import", {
        method: "POST",
        headers: adminMutationHeaders(csrfToken),
      });
      const json = (await response.json()) as InboxResponse;

      if (!response.ok || !json.success || !json.data) {
        setFeedback({
          message: json.message || "Neizdevās importēt WhatsApp rādījumus.",
          variant: "error",
        });
        return;
      }

      await applyInboxResponse(json);
      importedCount = json.data.importSummary?.imported ?? 0;
      failedCount = json.data.importSummary?.failed ?? 0;
      importSucceeded = true;
    });

    if (!importSucceeded) {
      return;
    }

    setFeedback({
      message: `${successPrefix}: ${importedCount} pievienoti, ${failedCount} kļūdas.`,
      variant: failedCount > 0 ? "warning" : "success",
    });
  }

  async function handleReparse() {
    let reparsedCount = 0;
    let reparsedSuccessfully = false;

    await runPendingAction("reparse", setPendingAction, async () => {
      const response = await fetch("/api/admin/whatsapp/inbox?action=reparse", {
        method: "POST",
        headers: adminMutationHeaders(csrfToken),
      });
      const json = (await response.json()) as InboxResponse;

      if (!response.ok || !json.success || !json.data) {
        setFeedback({
          message: json.message || "Neizdevās pārparsēt WhatsApp ziņas.",
          variant: "error",
        });
        return;
      }

      await applyInboxResponse(json);
      reparsedCount = json.data.reparsedCount ?? 0;
      reparsedSuccessfully = true;
    });

    if (reparsedSuccessfully) {
      await runImportBatch(
        `Pārparsēti ${reparsedCount} WhatsApp ieraksti, imports sadalīts mazā batch`,
      );
    }
  }

  async function confirmDeleteMessage() {
    if (!messageToDelete) {
      return;
    }

    await runPendingAction("delete", setPendingAction, async () => {
      const response = await fetch(
        `/api/admin/whatsapp/inbox?id=${encodeURIComponent(messageToDelete.id)}`,
        {
          method: "DELETE",
          headers: adminMutationHeaders(csrfToken),
        },
      );
      const json = (await response.json()) as InboxResponse;

      if (!response.ok || !json.success || !json.data) {
        setFeedback({
          message: json.message || "Neizdevās dzēst WhatsApp ierakstu.",
          variant: "error",
        });
        return;
      }

      setMessages(json.data.messages);
      setMessageToDelete(null);
      if (expandedId === messageToDelete.id) {
        setExpandedId(null);
      }
      setFeedback({ message: "WhatsApp ieraksts dzēsts.", variant: "success" });
    });
  }

  const isBusy = pendingAction !== null;

  async function handleSaveWhatsapp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runPendingAction("save", setPendingAction, async () => {
      const result = await updateSettings({
        whatsappNumber: draft.whatsappNumber.trim(),
        whatsappMode: draft.whatsappMode,
        whatsappMessageTemplate: draft.whatsappMessageTemplate.trim(),
        whatsappPhoneNumberId: draft.whatsappPhoneNumberId.trim(),
        whatsappNotifyNumber: draft.whatsappNotifyNumber.trim(),
        whatsappTemplateName: draft.whatsappTemplateName.trim(),
        whatsappTemplateLanguage: draft.whatsappTemplateLanguage.trim(),
        ...(whatsappTokenDraft.trim() ? { whatsappAccessToken: whatsappTokenDraft.trim() } : {}),
      });

      if (!result.ok) {
        setFeedback({ message: result.message, variant: "error" });
        return;
      }

      setDraft(toWhatsappDraft(result.data));
      setWhatsappTokenDraft("");
      setFeedback({ message: "WhatsApp iestatījumi saglabāti.", variant: "success" });
    });
  }

  async function handleWhatsappTest() {
    await runPendingAction("test", setPendingAction, async () => {
      const result = await sendWhatsappTestMessage();
      setFeedback({
        message: result.message,
        variant: result.ok ? "success" : "error",
      });
    });
  }

  return (
    <>
      <form onSubmit={(event) => void handleSaveWhatsapp(event)} className={`${cardClassName} space-y-4`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">WhatsApp iestatījumi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Rādījumu iesniegšana ar WhatsApp — saite uz numuru vai automātiska sūtīšana caur
            WhatsApp Business Cloud API.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="whatsapp-settings-number" className={labelClassName}>
              WhatsApp numurs
            </label>
            <IconInput
              id="whatsapp-settings-number"
              type="tel"
              value={draft.whatsappNumber}
              onChange={(event) => setDraft({ ...draft, whatsappNumber: event.target.value })}
              placeholder="+371 2X XXX XXX"
              icon={<IconChat className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div>
            <label htmlFor="whatsapp-settings-mode" className={labelClassName}>
              Rādījumu kanāls
            </label>
            <IconSelect
              id="whatsapp-settings-mode"
              value={draft.whatsappMode}
              onChange={(event) =>
                setDraft({ ...draft, whatsappMode: event.target.value as WhatsappMode })
              }
              icon={<IconChat className="size-4" />}
              wrapperClassName="mt-1"
            >
              {WHATSAPP_MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {WHATSAPP_MODE_LABELS[mode]}
                </option>
              ))}
            </IconSelect>
            <p className="mt-1 text-xs text-zinc-500">
              Saite atver lietotāja WhatsApp ar sagatavotu ziņu uz norādīto numuru. API režīmā
              ziņu nosūta serveris.
            </p>
          </div>
        </div>

        <div>
          <p className={labelClassName}>Statuss</p>
          <p className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            {whatsappStatusText(state.settings)}
          </p>
        </div>

        {draft.whatsappMode === "api" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="whatsapp-settings-phone-id" className={labelClassName}>
                  Sūtītāja numura ID (Phone number ID)
                </label>
                <IconInput
                  id="whatsapp-settings-phone-id"
                  type="text"
                  value={draft.whatsappPhoneNumberId}
                  onChange={(event) =>
                    setDraft({ ...draft, whatsappPhoneNumberId: event.target.value })
                  }
                  placeholder="123456789012345"
                  icon={<IconHash className="size-4" />}
                  wrapperClassName="mt-1"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Meta for Developers → WhatsApp → API Setup. Ja tukšs, tiek lietots
                  WHATSAPP_PHONE_NUMBER_ID no servera vides.
                </p>
              </div>
              <div>
                <label htmlFor="whatsapp-settings-token" className={labelClassName}>
                  Piekļuves tokens
                </label>
                <PasswordInput
                  id="whatsapp-settings-token"
                  value={whatsappTokenDraft}
                  onChange={(event) => setWhatsappTokenDraft(event.target.value)}
                  placeholder={
                    state.settings.whatsappAccessTokenConfigured
                      ? "Tokens saglabāts — atstājiet tukšu, lai nemainītu"
                      : "Ievadiet pastāvīgo piekļuves tokenu"
                  }
                  wrapperClassName="mt-1"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="whatsapp-settings-notify" className={labelClassName}>
                  Paziņojumu numurs
                </label>
                <IconInput
                  id="whatsapp-settings-notify"
                  type="tel"
                  value={draft.whatsappNotifyNumber}
                  onChange={(event) =>
                    setDraft({ ...draft, whatsappNotifyNumber: event.target.value })
                  }
                  placeholder="+371 2X XXX XXX"
                  icon={<IconPhone className="size-4" />}
                  wrapperClassName="mt-1"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Saņēmējs, uz kuru serveris sūta rādījumus. Nedrīkst būt tas pats numurs, kas
                  reģistrēts kā sūtītājs.
                </p>
              </div>
              <div>
                <label htmlFor="whatsapp-settings-template-name" className={labelClassName}>
                  Veidnes nosaukums
                </label>
                <IconInput
                  id="whatsapp-settings-template-name"
                  type="text"
                  value={draft.whatsappTemplateName}
                  onChange={(event) =>
                    setDraft({ ...draft, whatsappTemplateName: event.target.value })
                  }
                  placeholder="meter_readings"
                  icon={<IconMessage className="size-4" />}
                  wrapperClassName="mt-1"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Neobligāts. Ja tukšs, tiek sūtīts brīva teksta ziņojums, kas WhatsApp atļauts
                  tikai 24 h laikā pēc saņēmēja ziņas.
                </p>
              </div>
              <div>
                <label htmlFor="whatsapp-settings-template-language" className={labelClassName}>
                  Veidnes valoda
                </label>
                <IconInput
                  id="whatsapp-settings-template-language"
                  type="text"
                  value={draft.whatsappTemplateLanguage}
                  onChange={(event) =>
                    setDraft({ ...draft, whatsappTemplateLanguage: event.target.value })
                  }
                  placeholder="lv"
                  icon={<IconHash className="size-4" />}
                  wrapperClassName="mt-1"
                />
              </div>
            </div>
          </>
        ) : null}

        <div>
          <label htmlFor="whatsapp-settings-template" className={labelClassName}>
            WhatsApp ziņas teksts
          </label>
          <textarea
            id="whatsapp-settings-template"
            value={draft.whatsappMessageTemplate}
            onChange={(event) =>
              setDraft({ ...draft, whatsappMessageTemplate: event.target.value })
            }
            rows={5}
            className={`${inputClassName} mt-1 min-h-32 resize-y`}
            placeholder={WHATSAPP_MESSAGE_TEMPLATE}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Vietturi: {"{client_number}"}, {"{address}"}, {"{month}"}, {"{readings}"}. Rādījumi
            tiek ievietoti kā atsevišķas rindas ar skaitītāja veidu un numuru.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {draft.whatsappMode === "api" ? (
            <ActionButton
              type="button"
              variant="secondary"
              loading={pendingAction === "test"}
              disabled={isBusy}
              icon={<IconSend />}
              onClick={() => void handleWhatsappTest()}
            >
              Sūtīt testa ziņu
            </ActionButton>
          ) : null}
          <ActionButton
            type="submit"
            loading={pendingAction === "save"}
            disabled={isBusy}
            icon={<IconSave />}
          >
            Saglabāt
          </ActionButton>
        </div>
      </form>

      <div className={`${cardClassName} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">WhatsApp rādījumi</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Klienti sūta ziņu uz WhatsApp biznesa numuru. Ziņa tiek parsēta pēc klienta
              numura; ja klientam ir norādīts telefons, tas papildus tiek pārbaudīts pret
              sūtītāja WhatsApp ID.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              type="button"
              variant="secondary"
              loading={pendingAction === "import"}
              disabled={isBusy || messages.length === 0}
              icon={<IconRefresh />}
              onClick={() => void runImportBatch()}
            >
              Importēt nākamo batch
            </ActionButton>
            <ActionButton
              type="button"
              variant="secondary"
              loading={pendingAction === "reparse"}
              disabled={isBusy || messages.length === 0}
              icon={<IconChat />}
              onClick={() => void handleReparse()}
            >
              Pārparsēt tekstu
            </ActionButton>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">Webhook statuss</p>
          <p className="mt-1">
            {webhookConfigured
              ? "Konfigurēts (WHATSAPP_WEBHOOK_VERIFY_TOKEN + WHATSAPP_APP_SECRET). Callback URL: /api/public/whatsapp/webhook"
              : "Nav konfigurēts. .env.local pievienojiet WHATSAPP_WEBHOOK_VERIFY_TOKEN un WHATSAPP_APP_SECRET, tad Meta panelī iestatiet webhook uz /api/public/whatsapp/webhook."}
          </p>
        </div>
      </div>

      <section className={cardClassName}>
        <div className="flex items-center gap-2">
          <IconChat className="size-4 text-zinc-500" />
          <h3 className="text-base font-semibold text-zinc-900">Saņemtās WhatsApp ziņas</h3>
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Vēl nav saņemta neviena WhatsApp ziņa. Kad Meta webhook ir aktīvs, ziņas parādīsies
            šeit automātiski.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className={`${tableClassName} w-full table-fixed`}>
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="w-36 px-3 py-2 font-medium">Saņemts</th>
                  <th className="px-3 py-2 font-medium">Sūtītājs / ziņa</th>
                  <th className="w-48 px-3 py-2 font-medium">Klients</th>
                  <th className="px-3 py-2 font-medium">Rādījumi</th>
                  <th className="w-14 px-3 py-2 font-medium">Darbības</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map(({ message, matchedClient, enriched, phoneOk }) => (
                  <tr key={message.id} className="align-top text-zinc-800">
                    <td className="px-3 py-3 text-sm whitespace-nowrap">
                      {message.receivedAt
                        ? formatDateTimeDisplay(message.receivedAt)
                        : formatDateTimeDisplay(message.fetchedAt)}
                    </td>
                    <td className="min-w-0 px-3 py-3">
                      <button
                        type="button"
                        className="w-full text-left"
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
                          {message.fromProfileName || "WhatsApp"}
                        </p>
                        <p className="mt-1 break-all text-xs text-zinc-500">
                          {message.fromWaId || "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={statusBadgeClassName(message.parseStatus === "parsed")}>
                            {PARSE_STATUS_LABELS[message.parseStatus]}
                          </span>
                          {matchedClient?.phone.trim() ? (
                            <span className={statusBadgeClassName(phoneOk)}>
                              {phoneOk ? "Telefons OK" : "Telefons nesakrīt"}
                            </span>
                          ) : null}
                          {message.submissionImportedAt ? (
                            <span className={statusBadgeClassName(true)}>
                              Pievienots nodotajiem rādījumiem
                              {message.submissionMonth
                                ? ` · ${formatMonthLabel(message.submissionMonth)}`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                      </button>
                      {message.submissionImportedAt ? null : expandedId === message.id ? (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">
                          {message.bodyText}
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
                          {matchedClient.phone.trim() ? (
                            <p className="mt-1 text-xs text-zinc-500">{matchedClient.phone}</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-zinc-500">
                          {message.parsed.clientNumber
                            ? `Nr. ${message.parsed.clientNumber}`
                            : "Nav atrasts"}
                        </p>
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-3 text-sm">
                      {enriched.matchedReadings.length === 0 ? (
                        <p className="text-zinc-500">—</p>
                      ) : (
                        <ul className="space-y-1">
                          {enriched.matchedReadings.map((item, index) => (
                            <li key={`${message.id}-${index}`} className="text-xs text-zinc-700">
                              {formatMatchedReadingSummary(item)}{" "}
                              <span className="text-zinc-500">
                                ({formatReading(item.source.currentValue)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <TooltipIconButton
                        tooltip="Dzēst"
                        icon={<IconTrash />}
                        variant="danger"
                        disabled={isBusy}
                        onClick={() => setMessageToDelete(message)}
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
          title="Dzēst WhatsApp ierakstu?"
          message="Vai tiešām vēlaties dzēst šo saņemto WhatsApp ziņu no inbox?"
          confirmLabel="Dzēst"
          confirmVariant="danger"
          onConfirm={() => void confirmDeleteMessage()}
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
