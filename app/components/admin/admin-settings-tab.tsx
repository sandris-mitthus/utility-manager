"use client";

import { FormEvent, useState } from "react";
import { useDemoData } from "@/app/components/demo-data-provider";
import {
  cardClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
} from "@/app/components/ui/form-styles";
import { IconSave } from "@/app/components/ui/icons";
import type { DemoContactSettings } from "@/app/lib/demo/types";

export function AdminSettingsTab() {
  const { state, updateSettings } = useDemoData();
  const [draft, setDraft] = useState<DemoContactSettings>(state.settings);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSettings({
      email: draft.email.trim(),
      emailPassword: draft.emailPassword,
      smsNumber: draft.smsNumber.trim(),
      whatsappNumber: draft.whatsappNumber.trim(),
      phoneNumber: draft.phoneNumber.trim(),
    });
    setSaved(true);
  }

  return (
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
          <input
            id="settings-email"
            type="email"
            value={draft.email}
            onChange={(event) => {
              setDraft({ ...draft, email: event.target.value });
              setSaved(false);
            }}
            className={`${inputClassName} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="settings-email-password" className={labelClassName}>
            E-pasta parole (demo)
          </label>
          <input
            id="settings-email-password"
            type="password"
            value={draft.emailPassword}
            onChange={(event) => {
              setDraft({ ...draft, emailPassword: event.target.value });
              setSaved(false);
            }}
            className={`${inputClassName} mt-1`}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="settings-phone" className={labelClassName}>
            Tālrunis zvanīšanai
          </label>
          <input
            id="settings-phone"
            value={draft.phoneNumber}
            onChange={(event) => {
              setDraft({ ...draft, phoneNumber: event.target.value });
              setSaved(false);
            }}
            className={`${inputClassName} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="settings-sms" className={labelClassName}>
            SMS numurs
          </label>
          <input
            id="settings-sms"
            value={draft.smsNumber}
            onChange={(event) => {
              setDraft({ ...draft, smsNumber: event.target.value });
              setSaved(false);
            }}
            className={`${inputClassName} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="settings-whatsapp" className={labelClassName}>
            WhatsApp numurs
          </label>
          <input
            id="settings-whatsapp"
            value={draft.whatsappNumber}
            onChange={(event) => {
              setDraft({ ...draft, whatsappNumber: event.target.value });
              setSaved(false);
            }}
            className={`${inputClassName} mt-1`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClassName}>
          <IconSave />
          Saglabāt
        </button>
        {saved ? (
          <span className="text-sm text-emerald-700">Iestatījumi saglabāti demo režīmā.</span>
        ) : null}
      </div>
    </form>
  );
}
