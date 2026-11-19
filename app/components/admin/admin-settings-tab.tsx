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
import { IconInput } from "@/app/components/ui/icon-input";
import { IconCalendar, IconMessage, IconPhone, IconSave } from "@/app/components/ui/icons";
import { runPendingAction } from "@/app/lib/run-pending-action";
import { readingWindowHint } from "@/app/lib/utility/reading-window";
import type { AdminContactSettings } from "@/app/lib/utility/types";

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

function toDraft(settings: AdminContactSettings) {
  return {
    smsNumber: settings.smsNumber,
    phoneNumber: settings.phoneNumber,
    readingSubmissionTemplate: settings.readingSubmissionTemplate,
    readingWindowDays: settings.readingWindowDays,
  };
}

export function AdminSettingsTab() {
  const { state, updateSettings } = useAdminData();
  const [draft, setDraft] = useState(() => toDraft(state.settings));
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | null>(null);
  const isBusy = pendingAction !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runPendingAction("save", setPendingAction, async () => {
      const result = await updateSettings({
        smsNumber: draft.smsNumber.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        readingSubmissionTemplate: draft.readingSubmissionTemplate.trim(),
        readingWindowDays: draft.readingWindowDays,
      });

      if (!result.ok) {
        setFeedback({ message: result.message, variant: "error" });
        return;
      }

      setDraft(toDraft(result.data));
      setFeedback({ message: "Iestatījumi saglabāti.", variant: "success" });
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className={`${cardClassName} space-y-4`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Iestatījumi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Rādījumu periods, tālruņi un FAQ kopējamais teksts. E-pasts un WhatsApp ir savās
            sadaļās.
          </p>
        </div>

        <div>
          <label htmlFor="settings-reading-window" className={labelClassName}>
            Rādījumus drīkst nodot pēdējās mēneša dienas
          </label>
          <IconInput
            id="settings-reading-window"
            type="number"
            min={0}
            max={31}
            step={1}
            inputMode="numeric"
            value={draft.readingWindowDays}
            onChange={(event) => {
              const next = Number(event.target.value);
              setDraft({
                ...draft,
                readingWindowDays: Number.isFinite(next) ? Math.min(31, Math.max(0, Math.trunc(next))) : 0,
              });
            }}
            placeholder="0"
            icon={<IconCalendar className="size-4" />}
            wrapperClassName="mt-1 max-w-xs"
          />
          <p className="mt-1 text-xs text-zinc-500">
            0 nozīmē visu mēnesi. Piemēram, 5 ir tikai pēdējās 5 dienas. {readingWindowHint(draft.readingWindowDays)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
            placeholder={`Klienta kods: KLIENTA KODS
Aukstais ūdens: AUKSTA ŪDENS RĀDĪJUMI
Karstais ūdens: KARSTA ŪDENS RĀDĪJUMI
Kanalizācija: KANALIZĀCIJAS RĀDĪJUMI`}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Šis teksts tiek rādīts publiskā FAQ sadaļā pie SMS, WhatsApp un e-pasta
            ieteicamā kopējamā parauga.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
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
