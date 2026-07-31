"use client";

import { memo, useCallback, FormEvent, useEffect, useMemo, useState } from "react";
import { usePublicData } from "@/app/components/public-data-provider";
import { ActionButton } from "@/app/components/ui/action-button";
import {
  cardClassName,
} from "@/app/components/ui/form-styles";
import { IconInput } from "@/app/components/ui/icon-input";
import { IconArrowLeft, IconChat, IconGauge, IconSend } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { runPendingAction } from "@/app/lib/run-pending-action";
import {
  calculateConsumption,
  formatReading,
  getCurrentMonthKey,
  METER_TYPE_LABELS,
  parseReadingInput,
  sanitizeReadingInput,
} from "@/app/lib/utility/helpers";
import {
  buildWhatsappLinkUrl,
  buildWhatsappReadingMessage,
} from "@/app/lib/utility/whatsapp-message";
import type { UtilityClient, UtilityMeter } from "@/app/lib/utility/types";

type MeterReadingFormProps = {
  client: UtilityClient;
  meters: UtilityMeter[];
  submissionToken: string;
  hasSubmissionThisMonth: boolean;
  onBack: () => void;
  onSubmissionComplete: () => void;
};

type MeterReadingCardProps = {
  meter: UtilityMeter;
  value: string;
  consumption: number | null;
  onValueChange: (meterId: string, nextValue: string) => void;
};

const MeterReadingCard = memo(function MeterReadingCard({
  meter,
  value,
  consumption,
  onValueChange,
}: MeterReadingCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-900">{METER_TYPE_LABELS[meter.type]}</p>
        <div className="mt-1 flex items-start justify-between gap-4">
          <p className="text-xs text-zinc-500">
            {meter.number} · {meter.location}
          </p>
          <p className="shrink-0 text-right text-xs text-zinc-500">
            Skaitītāja rādījums uz skaitītāja:{" "}
            <span className="font-medium text-zinc-900">{formatReading(meter.previousReading)}</span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={`reading-${meter.id}`} className="sr-only">
          Pašreizējais rādījums
        </label>
        <IconInput
          id={`reading-${meter.id}`}
          type="text"
          inputMode="decimal"
          pattern="[0-9.,]*"
          placeholder="piem., 125.4"
          value={value}
          onChange={(event) => onValueChange(meter.id, event.target.value)}
          icon={<IconGauge className="size-4" />}
          className="text-right text-base"
        />

        <p className="mt-2 text-right text-sm text-zinc-600">
          Šī mēneša patēriņš:{" "}
          <span className="font-semibold text-zinc-900">
            {consumption !== null ? `${formatReading(consumption)} m³` : "— m³"}
          </span>
        </p>
      </div>
    </div>
  );
});

export function MeterReadingForm({
  client,
  meters,
  submissionToken,
  hasSubmissionThisMonth,
  onBack,
  onSubmissionComplete,
}: MeterReadingFormProps) {
  const { submitReadings, sendReadingsToWhatsapp, settings } = usePublicData();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  const parsedValues = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const meter of meters) {
      result[meter.id] = parseReadingInput(values[meter.id] ?? "");
    }
    return result;
  }, [meters, values]);

  const [pendingAction, setPendingAction] = useState<"submit" | "whatsapp" | null>(null);
  const isBusy = pendingAction !== null;

  const handleValueChange = useCallback(
    (meterId: string, nextValue: string) => {
      setValues((current) => ({
        ...current,
        [meterId]: sanitizeReadingInput(nextValue),
      }));
      setWhatsappSent(false);
      if (error) {
        setError(null);
      }
    },
    [error],
  );

  /** Atgriež validētus rādījumus vai null, uzstādot kļūdas tekstu. */
  function collectReadings(): Record<string, number> | null {
    const readings: Record<string, number> = {};

    for (const meter of meters) {
      const parsed = parsedValues[meter.id];
      if (parsed === null) {
        setError(`Ievadiet derīgu rādījumu skaitītājam ${meter.number}.`);
        return null;
      }
      if (parsed < meter.previousReading) {
        setError(
          `Skaitītājam ${meter.number} rādījums nevar būt mazāks par iepriekšējo periodu (${formatReading(meter.previousReading)}).`,
        );
        return null;
      }
      readings[meter.id] = parsed;
    }

    return readings;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runPendingAction("submit", setPendingAction, async () => {
      setError(null);

      const readings = collectReadings();
      if (!readings) {
        return;
      }

      const result = await submitReadings(client.id, submissionToken, readings);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setRedirectCountdown(5);
      setSuccess(true);
    });
  }

  async function handleWhatsappSend() {
    await runPendingAction("whatsapp", setPendingAction, async () => {
      setError(null);
      setWhatsappSent(false);

      const readings = collectReadings();
      if (!readings) {
        return;
      }

      const message = buildWhatsappReadingMessage(settings.whatsappMessageTemplate, {
        clientNumber: client.clientNumber,
        address: client.address,
        month: getCurrentMonthKey(),
        readings: meters.map((meter) => ({
          meterNumber: meter.number,
          type: meter.type,
          value: readings[meter.id],
        })),
      });

      if (settings.whatsappMode === "link") {
        const url = buildWhatsappLinkUrl(settings.whatsappNumber, message);
        if (!url) {
          setError("WhatsApp numurs nav norādīts. Sazinieties ar administratoru.");
          return;
        }

        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      const result = await sendReadingsToWhatsapp(client.id, submissionToken, readings);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setWhatsappSent(true);
    });
  }

  useEffect(() => {
    if (!success && !hasSubmissionThisMonth) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRedirectCountdown((current) => Math.max(current - 1, 0));
    }, 1_000);
    const timeoutId = window.setTimeout(onSubmissionComplete, 5_000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [hasSubmissionThisMonth, onSubmissionComplete, success]);

  if (hasSubmissionThisMonth) {
    return (
      <div className={`${cardClassName} text-center`}>
        <h2 className="text-lg font-semibold text-zinc-900">Rādījumi jau iesniegti</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Šī mēneša rādījumi klientam{" "}
          <span className="font-semibold text-zinc-900">Nr. {client.clientNumber}</span> jau ir
          saglabāti.
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          Pēc {redirectCountdown} sek. atgriezīsim sākuma lapā.
        </p>
        <ActionButton
          type="button"
          variant="primary"
          onClick={onSubmissionComplete}
          icon={<IconArrowLeft />}
          className="mt-6"
        >
          Atpakaļ tagad
        </ActionButton>
      </div>
    );
  }

  if (success) {
    return (
      <div className={cardClassName}>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-success-title"
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl"
          >
            <h2 id="submission-success-title" className="text-lg font-semibold text-zinc-900">
              Rādījumi iesniegti
            </h2>
            <p className="mt-3 text-sm text-zinc-600">
              Paldies! Rādījumi klientam{" "}
              <span className="font-semibold text-zinc-900">Nr. {client.clientNumber}</span> ir
              saglabāti.
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              Pēc {redirectCountdown} sek. atgriezīsim sākuma lapā.
            </p>
            <ActionButton
              type="button"
              variant="primary"
              onClick={onSubmissionComplete}
              icon={<IconArrowLeft />}
              className="mt-6"
            >
              Atpakaļ tagad
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  if (meters.length === 0) {
    return (
      <div className={cardClassName}>
        <p className="text-sm text-zinc-600">Klientam nav piesaistītu skaitītāju.</p>
        <ActionButton
          type="button"
          variant="secondary"
          onClick={onBack}
          icon={<IconArrowLeft />}
          className="mt-4"
        >
          Atpakaļ
        </ActionButton>
      </div>
    );
  }

  return (
    <div className={cardClassName}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Skaitītāju rādījumi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ievadiet pašreizējos rādījumus visiem skaitītājiem
          </p>
        </div>
        <TooltipIconButton
          tooltip="Atgriezties pie klienta meklēšanas"
          icon={<IconArrowLeft />}
          variant="secondary"
          onClick={onBack}
        />
      </div>

      <dl className="mt-5 grid gap-3 rounded-lg bg-zinc-50 px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Klienta numurs</dt>
          <dd className="font-medium text-zinc-900">{client.clientNumber}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Adrese</dt>
          <dd className="font-medium text-zinc-900">{client.address}</dd>
        </div>
      </dl>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        {meters.map((meter) => {
          const currentValue = parsedValues[meter.id];
          const consumption = calculateConsumption(meter.previousReading, currentValue);

          return (
            <MeterReadingCard
              key={meter.id}
              meter={meter}
              value={values[meter.id] ?? ""}
              consumption={consumption}
              onValueChange={handleValueChange}
            />
          );
        })}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {whatsappSent ? (
          <p className="text-sm text-emerald-700">
            Rādījumi nosūtīti ar WhatsApp. Lai tie tiktu saglabāti sistēmā, iesniedziet tos arī
            šeit.
          </p>
        ) : null}

        <ActionButton
          type="submit"
          variant="primary"
          className="w-full !py-3"
          loading={pendingAction === "submit"}
          disabled={isBusy}
          icon={<IconSend />}
        >
          Iesniegt rādījumus
        </ActionButton>

        {settings.whatsappMode !== "off" ? (
          <>
            <ActionButton
              type="button"
              variant="secondary"
              className="w-full !py-3"
              loading={pendingAction === "whatsapp"}
              disabled={isBusy}
              icon={<IconChat />}
              onClick={() => void handleWhatsappSend()}
            >
              Nosūtīt ar WhatsApp
            </ActionButton>
            <p className="text-center text-xs text-zinc-500">
              {settings.whatsappMode === "link"
                ? "Atveras WhatsApp ar sagatavotu ziņu — jums to atliek nosūtīt."
                : "Rādījumi tiek nosūtīti kā WhatsApp ziņa klientu apkalpošanai."}
            </p>
          </>
        ) : null}
      </form>
    </div>
  );
}
