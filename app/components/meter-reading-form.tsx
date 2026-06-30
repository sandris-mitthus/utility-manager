"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePublicData } from "@/app/components/public-data-provider";
import { ActionButton } from "@/app/components/ui/action-button";
import {
  cardClassName,
} from "@/app/components/ui/form-styles";
import { IconInput } from "@/app/components/ui/icon-input";
import { IconArrowLeft, IconGauge, IconSend } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { runPendingAction } from "@/app/lib/run-pending-action";
import {
  calculateConsumption,
  formatReading,
  METER_TYPE_LABELS,
  parseReadingInput,
  sanitizeReadingInput,
} from "@/app/lib/utility/helpers";
import type { UtilityClient, UtilityMeter } from "@/app/lib/utility/types";

type MeterReadingFormProps = {
  client: UtilityClient;
  meters: UtilityMeter[];
  submissionToken: string;
  hasSubmissionThisMonth: boolean;
  onBack: () => void;
  onSubmissionComplete: () => void;
};

type SubmitProgressStep = "validating" | "saving" | "syncing" | "finishing";

const SUBMIT_PROGRESS_LABELS: Record<SubmitProgressStep, string> = {
  validating: "Pārbaudām ievadītos rādījumus",
  saving: "Saglabājam rādījumus sistēmā",
  syncing: "Sinhronizējam Google Sheet",
  finishing: "Pabeidzam iesniegšanu",
};

export function MeterReadingForm({
  client,
  meters,
  submissionToken,
  hasSubmissionThisMonth,
  onBack,
  onSubmissionComplete,
}: MeterReadingFormProps) {
  const { submitReadings } = usePublicData();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [submitProgressStep, setSubmitProgressStep] = useState<SubmitProgressStep | null>(null);

  const parsedValues = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const meter of meters) {
      result[meter.id] = parseReadingInput(values[meter.id] ?? "");
    }
    return result;
  }, [meters, values]);

  const [pendingAction, setPendingAction] = useState<"submit" | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runPendingAction("submit", setPendingAction, async () => {
      setError(null);
      setSubmitProgressStep("validating");

      const readings: Record<string, number> = {};
      for (const meter of meters) {
        const parsed = parsedValues[meter.id];
        if (parsed === null) {
          setError(`Ievadiet derīgu rādījumu skaitītājam ${meter.number}.`);
          setSubmitProgressStep(null);
          return;
        }
        if (parsed < meter.previousReading) {
          setError(
            `Skaitītājam ${meter.number} rādījums nevar būt mazāks par iepriekšējo periodu (${formatReading(meter.previousReading)}).`,
          );
          setSubmitProgressStep(null);
          return;
        }
        readings[meter.id] = parsed;
      }

      setSubmitProgressStep("saving");
      window.setTimeout(() => {
        setSubmitProgressStep((current) => (current === "saving" ? "syncing" : current));
      }, 700);

      const result = await submitReadings(client.id, submissionToken, readings);
      if (!result.ok) {
        setError(result.message);
        setSubmitProgressStep(null);
        return;
      }

      setSubmitProgressStep("finishing");
      setRedirectCountdown(5);
      setSuccess(true);
    });
  }

  useEffect(() => {
    if (!success) {
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
  }, [onSubmissionComplete, success]);

  if (hasSubmissionThisMonth) {
    return (
      <div className={`${cardClassName} text-center`}>
        <h2 className="text-lg font-semibold text-zinc-900">Rādījumi jau iesniegti</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Šī mēneša rādījumi klientam{" "}
          <span className="font-semibold text-zinc-900">Nr. {client.clientNumber}</span> jau ir
          saglabāti.
        </p>
        <ActionButton
          type="button"
          variant="primary"
          onClick={onBack}
          icon={<IconArrowLeft />}
          className="mt-6"
        >
          Atpakaļ
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
            <div
              key={meter.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {METER_TYPE_LABELS[meter.type]}
                </p>
                <div className="mt-1 flex items-start justify-between gap-4">
                  <p className="text-xs text-zinc-500">
                    {meter.number} · {meter.location}
                  </p>
                  <p className="shrink-0 text-right text-xs text-zinc-500">
                    Skaitītāja rādījums uz skaitītāja:{" "}
                    <span className="font-medium text-zinc-900">
                      {formatReading(meter.previousReading)}
                    </span>
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
                  value={values[meter.id] ?? ""}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      [meter.id]: sanitizeReadingInput(event.target.value),
                    }));
                    if (error) {
                      setError(null);
                    }
                  }}
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
        })}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {submitProgressStep ? (
          <div
            className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"
            role="status"
            aria-live="polite"
          >
            <p className="font-medium">{SUBMIT_PROGRESS_LABELS[submitProgressStep]}</p>
            <p className="mt-1 text-blue-800">
              Google Sheets sinhronizācija ir obligāta, tāpēc lūdzu uzgaidiet, līdz
              iesniegšana pilnībā pabeigta.
            </p>
          </div>
        ) : null}

        <ActionButton
          type="submit"
          variant="primary"
          className="w-full !py-3"
          loading={pendingAction === "submit"}
          disabled={pendingAction !== null}
          icon={<IconSend />}
        >
          Iesniegt rādījumus
        </ActionButton>
      </form>
    </div>
  );
}
