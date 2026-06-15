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
  labelClassName,
} from "@/app/components/ui/form-styles";
import { IconInput, PasswordInput } from "@/app/components/ui/icon-input";
import {
  IconChat,
  IconMail,
  IconMessage,
  IconPhone,
  IconSave,
} from "@/app/components/ui/icons";
import { runPendingAction } from "@/app/lib/run-pending-action";
import type { DemoContactSettings } from "@/app/lib/demo/types";

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

export function AdminSettingsTab() {
  const { state, updateSettings } = useAdminData();
  const [draft, setDraft] = useState<DemoContactSettings>(state.settings);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runPendingAction("save", setPendingAction, async () => {
      const result = await updateSettings({
        email: draft.email.trim(),
        emailPassword: draft.emailPassword,
        smsNumber: draft.smsNumber.trim(),
        whatsappNumber: draft.whatsappNumber.trim(),
        phoneNumber: draft.phoneNumber.trim(),
      });

      if (!result.ok) {
        setFeedback({ message: result.message, variant: "error" });
        return;
      }

      setFeedback({ message: "Iestatījumi saglabāti.", variant: "success" });
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className={`${cardClassName} space-y-4`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Iestatījumi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Kontaktinformācija rādījumu iesniegšanai un FAQ atbildēm
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
              value={draft.emailPassword}
              onChange={(event) => setDraft({ ...draft, emailPassword: event.target.value })}
              placeholder="ievadiet paroli"
              wrapperClassName="mt-1"
            />
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

        <div className="flex flex-wrap items-center justify-end gap-3">
          <ActionButton
            type="submit"
            variant="primary"
            loading={pendingAction === "save"}
            disabled={pendingAction !== null}
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
