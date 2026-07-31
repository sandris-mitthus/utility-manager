"use client";

import { FormEvent, useState } from "react";
import { useAdminData } from "@/app/components/admin-data-provider";
import {
  FeedbackToast,
  type FeedbackToastVariant,
} from "@/app/components/ui/feedback-toast";
import { ActionButton } from "@/app/components/ui/action-button";
import {
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/app/components/ui/form-styles";
import { IconInput, IconSelect, PasswordInput } from "@/app/components/ui/icon-input";
import {
  IconChat,
  IconHash,
  IconMail,
  IconMessage,
  IconPhone,
  IconSave,
  IconSend,
} from "@/app/components/ui/icons";
import { runPendingAction } from "@/app/lib/run-pending-action";
import {
  WHATSAPP_MESSAGE_TEMPLATE,
  WHATSAPP_MODE_LABELS,
} from "@/app/lib/utility/whatsapp-message";
import type {
  AdminContactSettings,
  ContactSettingsUpdate,
  WhatsappMode,
} from "@/app/lib/utility/types";

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

const WHATSAPP_MODE_OPTIONS: WhatsappMode[] = ["off", "link", "api"];

function toDraft(settings: AdminContactSettings) {
  return {
    email: settings.email,
    smsNumber: settings.smsNumber,
    whatsappNumber: settings.whatsappNumber,
    phoneNumber: settings.phoneNumber,
    readingSubmissionTemplate: settings.readingSubmissionTemplate,
    imapHost: settings.imapHost,
    whatsappMode: settings.whatsappMode,
    whatsappMessageTemplate: settings.whatsappMessageTemplate,
    whatsappPhoneNumberId: settings.whatsappPhoneNumberId,
    whatsappNotifyNumber: settings.whatsappNotifyNumber,
    whatsappTemplateName: settings.whatsappTemplateName,
    whatsappTemplateLanguage: settings.whatsappTemplateLanguage,
  };
}

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

export function AdminSettingsTab() {
  const { state, updateSettings, sendWhatsappTestMessage } = useAdminData();
  const [draft, setDraft] = useState(() => toDraft(state.settings));
  const [emailPasswordDraft, setEmailPasswordDraft] = useState("");
  const [whatsappTokenDraft, setWhatsappTokenDraft] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | "test" | null>(null);
  const isBusy = pendingAction !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runPendingAction("save", setPendingAction, async () => {
      const payload: ContactSettingsUpdate = {
        ...draft,
        email: draft.email.trim(),
        smsNumber: draft.smsNumber.trim(),
        whatsappNumber: draft.whatsappNumber.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        readingSubmissionTemplate: draft.readingSubmissionTemplate.trim(),
        imapHost: draft.imapHost.trim(),
        whatsappMessageTemplate: draft.whatsappMessageTemplate.trim(),
        whatsappPhoneNumberId: draft.whatsappPhoneNumberId.trim(),
        whatsappNotifyNumber: draft.whatsappNotifyNumber.trim(),
        whatsappTemplateName: draft.whatsappTemplateName.trim(),
        whatsappTemplateLanguage: draft.whatsappTemplateLanguage.trim(),
      };

      if (emailPasswordDraft.trim()) {
        payload.emailPassword = emailPasswordDraft.trim();
      }

      if (whatsappTokenDraft.trim()) {
        payload.whatsappAccessToken = whatsappTokenDraft.trim();
      }

      const result = await updateSettings(payload);

      if (!result.ok) {
        setFeedback({ message: result.message, variant: "error" });
        return;
      }

      setDraft(toDraft(result.data));
      setEmailPasswordDraft("");
      setWhatsappTokenDraft("");
      setFeedback({ message: "Iestatījumi saglabāti.", variant: "success" });
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
      <form onSubmit={handleSubmit} className={`${cardClassName} space-y-4`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Iestatījumi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Kontaktinformācija rādījumu iesniegšanai, e-pasta ievākšanai un FAQ atbildēm
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-email" className={labelClassName}>
              E-pasts rādījumu iesniegšanai
            </label>
            <IconInput
              id="settings-email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              placeholder="piemers@pasts.lv"
              icon={<IconMail className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div>
            <label htmlFor="settings-email-password" className={labelClassName}>
              E-pasta parole
            </label>
            <PasswordInput
              id="settings-email-password"
              value={emailPasswordDraft}
              onChange={(event) => setEmailPasswordDraft(event.target.value)}
              placeholder={
                state.settings.emailPasswordConfigured
                  ? "Parole saglabāta — atstājiet tukšu, lai nemainītu"
                  : "Ievadiet e-pasta konta paroli"
              }
              wrapperClassName="mt-1"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-imap-host" className={labelClassName}>
              IMAP serveris
            </label>
            <IconInput
              id="settings-imap-host"
              type="text"
              value={draft.imapHost}
              onChange={(event) => setDraft({ ...draft, imapHost: event.target.value })}
              placeholder="mail.piemers.lv"
              icon={<IconMail className="size-4" />}
              wrapperClassName="mt-1"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Serveris, kurā glabājas iesūtne. Ja tukšs, tiek lietots CONTACT_IMAP_HOST no servera
              vides.
            </p>
          </div>
          <div>
            <p className={labelClassName}>E-pasta ievākšana</p>
            <p className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              {state.settings.emailInboxConfigured
                ? "Gatava — e-pasts, parole un IMAP serveris ir konfigurēti. Izmantojiet cilni E-pasts."
                : "Norādiet e-pastu, paroli un IMAP serveri, lai sistēma varētu ievākt rādījumus no iesūtnes."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="settings-phone" className={labelClassName}>
              Tālrunis zvanīšanai
            </label>
            <IconInput
              id="settings-phone"
              type="tel"
              value={draft.phoneNumber}
              onChange={(event) => setDraft({ ...draft, phoneNumber: event.target.value })}
              placeholder="+371 2X XXX XXX"
              icon={<IconPhone className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div>
            <label htmlFor="settings-sms" className={labelClassName}>
              SMS numurs
            </label>
            <IconInput
              id="settings-sms"
              type="tel"
              value={draft.smsNumber}
              onChange={(event) => setDraft({ ...draft, smsNumber: event.target.value })}
              placeholder="+371 2X XXX XXX"
              icon={<IconMessage className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div>
            <label htmlFor="settings-whatsapp" className={labelClassName}>
              WhatsApp numurs
            </label>
            <IconInput
              id="settings-whatsapp"
              type="tel"
              value={draft.whatsappNumber}
              onChange={(event) => setDraft({ ...draft, whatsappNumber: event.target.value })}
              placeholder="+371 2X XXX XXX"
              icon={<IconChat className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
        </div>

        <div>
          <label htmlFor="settings-reading-template" className={labelClassName}>
            Ieteicamais rādījumu teksts FAQ blokiem
          </label>
          <textarea
            id="settings-reading-template"
            value={draft.readingSubmissionTemplate}
            onChange={(event) =>
              setDraft({ ...draft, readingSubmissionTemplate: event.target.value })
            }
            rows={5}
            className={`${inputClassName} mt-1 min-h-32 resize-y`}
            placeholder={`Klienta numurs: KLIENTA NUMURS
Aukstais ūdens: AUKSTA ŪDENS RĀDĪJUMI
Karstais ūdens: KARSTA ŪDENS RĀDĪJUMI
Kanalizācija: KANALIZĀCIJAS RĀDĪJUMI`}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Šis teksts tiek rādīts publiskā FAQ sadaļā pie SMS, WhatsApp un e-pasta
            ieteicamā kopējamā parauga.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">WhatsApp Business</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Rādījumu iesniegšana ar WhatsApp — saite uz numuru vai automātiska sūtīšana caur
              WhatsApp Business Cloud API
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-whatsapp-mode" className={labelClassName}>
                Rādījumu kanāls
              </label>
              <IconSelect
                id="settings-whatsapp-mode"
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
                Saite atver lietotāja WhatsApp ar sagatavotu ziņu uz augšā norādīto WhatsApp
                numuru. API režīmā ziņu nosūta serveris.
              </p>
            </div>
            <div>
              <p className={labelClassName}>Statuss</p>
              <p className="mt-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
                {whatsappStatusText(state.settings)}
              </p>
            </div>
          </div>

          {draft.whatsappMode === "api" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="settings-whatsapp-phone-id" className={labelClassName}>
                    Sūtītāja numura ID (Phone number ID)
                  </label>
                  <IconInput
                    id="settings-whatsapp-phone-id"
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
                  <label htmlFor="settings-whatsapp-token" className={labelClassName}>
                    Piekļuves tokens
                  </label>
                  <PasswordInput
                    id="settings-whatsapp-token"
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
                  <label htmlFor="settings-whatsapp-notify" className={labelClassName}>
                    Paziņojumu numurs
                  </label>
                  <IconInput
                    id="settings-whatsapp-notify"
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
                  <label htmlFor="settings-whatsapp-template-name" className={labelClassName}>
                    Veidnes nosaukums
                  </label>
                  <IconInput
                    id="settings-whatsapp-template-name"
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
                  <label htmlFor="settings-whatsapp-template-language" className={labelClassName}>
                    Veidnes valoda
                  </label>
                  <IconInput
                    id="settings-whatsapp-template-language"
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
            <label htmlFor="settings-whatsapp-template" className={labelClassName}>
              WhatsApp ziņas teksts
            </label>
            <textarea
              id="settings-whatsapp-template"
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
            variant="primary"
            loading={pendingAction === "save"}
            disabled={isBusy}
            icon={<IconSave />}
          >
            Saglabāt
          </ActionButton>
        </div>
      </form>

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
