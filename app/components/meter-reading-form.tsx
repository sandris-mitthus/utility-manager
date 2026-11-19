"use client";

import { memo, useCallback, FormEvent, useEffect, useMemo, useState } from "react";
import { usePublicData } from "@/app/components/public-data-provider";
import { ActionButton } from "@/app/components/ui/action-button";
import { FeedbackToast } from "@/app/components/ui/feedback-toast";
import {
  cardClassName,
} from "@/app/components/ui/form-styles";
import { IconInput } from "@/app/components/ui/icon-input";
import { IconArrowLeft, IconChat, IconChevronDown, IconGauge, IconSend } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { runPendingAction } from "@/app/lib/run-pending-action";
import {
  calculateConsumption,
  formatMonthLabel,
  formatReading,
  getCurrentMonthKey,
  groupMetersForReadingForm,
  METER_TYPE_LABELS,
  parseReadingInput,
  roundReading,
  sanitizeReadingInput,
  type ReadingFormTypeGroup,
} from "@/app/lib/utility/helpers";
import {
  getReadingWindowStatus,
  readingWindowClosedMessage,
} from "@/app/lib/utility/reading-window";
import {
  buildWhatsappLinkUrl,
  buildWhatsappReadingMessage,
} from "@/app/lib/utility/whatsapp-message";
import type { UtilityClient, UtilityMeter } from "@/app/lib/utility/types";

const READING_UNIT = "m³";

type MeterReadingFormProps = {
  client: UtilityClient;
  meters: UtilityMeter[];
  submissionToken: string;
  submittedReadings: Record<string, number>;
  submittedPreviousReadings: Record<string, number>;
  onBack: () => void;
  onSubmissionComplete: () => void;
};

type MeterReadingCardProps = {
  meter: UtilityMeter;
  value: string;
  consumption: number | null;
  previousReading: number;
  locked: boolean;
  onValueChange: (meterId: string, nextValue: string) => void;
};

const MeterReadingCard = memo(function MeterReadingCard({
  meter,
  value,
  consumption,
  previousReading,
  locked,
  onValueChange,
}: MeterReadingCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {meter.typeCode ? `${meter.typeCode} ` : ""}
            {meter.number}
          </p>
          {meter.location ? <p className="mt-1 text-xs text-zinc-500">{meter.location}</p> : null}
        </div>
        <p className="max-w-[16rem] text-right text-xs text-zinc-500">
          Skaitītāja rādījums iepriekšējā periodā:{" "}
          <span className="font-medium text-zinc-900">
            {formatReading(previousReading)} {READING_UNIT}
          </span>
        </p>
      </div>

      <div className="mt-4">
        <label htmlFor={`reading-${meter.id}`} className="sr-only">
          Pašreizējais rādījums, {READING_UNIT}
        </label>
        <IconInput
          id={`reading-${meter.id}`}
          type="text"
          inputMode="decimal"
          pattern="[0-9.,]*"
          placeholder={locked ? undefined : "piem., 125.405"}
          value={value}
          disabled={locked}
          onChange={(event) => onValueChange(meter.id, event.target.value)}
          icon={<IconGauge className="size-4" />}
          suffix={READING_UNIT}
          className={`text-right text-base ${locked ? "disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-600" : ""}`}
        />

        {locked ? <p className="mt-2 text-right text-xs text-zinc-500">Jau iesniegts</p> : null}

        <p className="mt-2 text-right text-sm text-zinc-600">
          Šī mēneša patēriņš:{" "}
          <span className="font-semibold text-zinc-900">
            {consumption !== null ? `${formatReading(consumption)} ${READING_UNIT}` : `— ${READING_UNIT}`}
          </span>
        </p>
      </div>
    </div>
  );
});

type AddressMeterRow = {
  meter: UtilityMeter;
  locked: boolean;
  value: string;
  previousReading: number;
  consumption: number | null;
};

function AddressReadingBlock({
  address,
  panelId,
  types,
  rows,
  monthLabel,
  onValueChange,
}: {
  address: string;
  panelId: string;
  types: ReadingFormTypeGroup[];
  rows: AddressMeterRow[];
  monthLabel: string;
  onValueChange: (meterId: string, nextValue: string) => void;
}) {
  const allSubmitted = rows.length > 0 && rows.every((row) => row.locked);
  const [open, setOpen] = useState(!allSubmitted);
  const expanded = !allSubmitted || open;
  const title = address || "Skaitītāji";

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200">
      {allSubmitted ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="min-w-0 text-sm font-semibold text-zinc-900">{title}</span>
          <IconChevronDown
            className={`size-4 shrink-0 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      ) : (
        <h3 className="px-4 py-3 text-sm font-semibold text-zinc-900">{title}</h3>
      )}

      {expanded ? (
        <div id={panelId} className="space-y-4 border-t border-zinc-200 px-4 py-4">
          {types.map((typeGroup) => (
            <div key={typeGroup.type} className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-800">
                {METER_TYPE_LABELS[typeGroup.type]}
              </h4>
              {typeGroup.meters.map((meter) => {
                const row = rows.find((item) => item.meter.id === meter.id);
                if (!row) {
                  return null;
                }

                return (
                  <MeterReadingCard
                    key={meter.id}
                    meter={meter}
                    value={row.value}
                    consumption={row.consumption}
                    previousReading={row.previousReading}
                    locked={row.locked}
                    onValueChange={onValueChange}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div id={panelId} className="border-t border-zinc-200 px-4 py-3">
          <ul className="space-y-2">
            <li className="text-xs text-zinc-500">Patēriņš, {monthLabel}</li>
            {rows.map((row) => (
              <li
                key={row.meter.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 text-zinc-700">
                  {METER_TYPE_LABELS[row.meter.type]} · {row.meter.number}
                </span>
                <span className="shrink-0 font-medium text-zinc-900">
                  {row.consumption !== null
                    ? `${formatReading(row.consumption)} ${READING_UNIT}`
                    : `— ${READING_UNIT}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function readingInputValue(value: number): string {
  return String(roundReading(value));
}

export function MeterReadingForm({
  client,
  meters,
  submissionToken,
  submittedReadings,
  submittedPreviousReadings,
  onBack,
  onSubmissionComplete,
}: MeterReadingFormProps) {
  const { submitReadings, sendReadingsToWhatsapp, settings } = usePublicData();
  const readingWindow = getReadingWindowStatus(settings.readingWindowDays);
  const showWhatsappSend =
    settings.whatsappMode !== "off" && settings.whatsappNumber.trim().length > 0;
  const allSubmitted =
    meters.length > 0 && meters.every((meter) => submittedReadings[meter.id] !== undefined);
  const hasLockedReading = meters.some((meter) => submittedReadings[meter.id] !== undefined);
  const meterGroups = useMemo(
    () => groupMetersForReadingForm(meters, client.address),
    [client.address, meters],
  );
  const monthLabel = formatMonthLabel(getCurrentMonthKey());
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const meter of meters) {
      const submitted = submittedReadings[meter.id];
      if (submitted !== undefined) {
        initial[meter.id] = readingInputValue(submitted);
      }
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [leftUnsubmitted, setLeftUnsubmitted] = useState(false);
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
      if (submittedReadings[meterId] !== undefined) {
        return;
      }

      setValues((current) => ({
        ...current,
        [meterId]: sanitizeReadingInput(nextValue),
      }));
      setWhatsappSent(false);
      setError(null);
    },
    [setError, submittedReadings],
  );

  /** Atgriež jauniesniedzamos rādījumus vai null, uzstādot kļūdas tekstu. Jau iesniegtos izlaiž. */
  function collectReadings(): Record<string, number> | null {
    const readings: Record<string, number> = {};
    let pendingCount = 0;

    for (const meter of meters) {
      if (submittedReadings[meter.id] !== undefined) {
        continue;
      }

      pendingCount += 1;
      const raw = (values[meter.id] ?? "").trim();
      if (!raw) {
        continue;
      }

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

    if (Object.keys(readings).length === 0) {
      setError(
        pendingCount === 0
          ? "Rādījumi šim mēnesim jau ir iesniegti."
          : "Ievadiet rādījumu vismaz vienam skaitītājam, kurš vēl nav iesniegts.",
      );
      return null;
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

      const stillOpen = meters.some(
        (meter) =>
          submittedReadings[meter.id] === undefined && readings[meter.id] === undefined,
      );
      setLeftUnsubmitted(stillOpen);
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
        readings: meters
          .filter((meter) => readings[meter.id] !== undefined)
          .map((meter) => ({
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
    if (!success && !allSubmitted) {
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
  }, [allSubmitted, onSubmissionComplete, success]);

  if (allSubmitted) {
    return (
      <div className={`${cardClassName} text-center`}>
        <h2 className="text-lg font-semibold text-zinc-900">Rādījumi jau iesniegti</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Šī mēneša rādījumi klientam{" "}
          <span className="font-semibold text-zinc-900">{client.clientNumber}</span> jau ir
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

  if (!readingWindow.open) {
    return (
      <div className={cardClassName}>
        <h2 className="text-lg font-semibold text-zinc-900">Rādījumus vēl nevar nodot</h2>
        <p className="mt-2 text-sm text-zinc-600">{readingWindowClosedMessage(readingWindow)}</p>
        <ActionButton
          type="button"
          variant="secondary"
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
              <span className="font-semibold text-zinc-900">{client.clientNumber}</span> ir
              saglabāti.
            </p>
            {leftUnsubmitted ? (
              <p className="mt-2 text-sm text-zinc-600">
                Pārējos skaitītājus varēsiet iesniegt vēlāk. Jau iesniegtos rādījumus vairs nevarēs
                labot.
              </p>
            ) : null}
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
            {hasLockedReading
              ? "Jau iesniegtos rādījumus nevar labot. Ievadiet atlikušos — tukšos varēsiet nodot vēlāk."
              : "Ievadiet pašreizējos rādījumus. Tukšos skaitītājus varēsiet nodot vēlāk."}
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
          <dt className="text-zinc-500">Klienta kods</dt>
          <dd className="font-medium text-zinc-900">{client.clientNumber}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{client.name ? "Klients" : "Adrese"}</dt>
          <dd className="font-medium text-zinc-900">{client.name || client.address}</dd>
        </div>
      </dl>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        {meterGroups.map((group, index) => {
          const rows = group.types.flatMap((typeGroup) =>
            typeGroup.meters.map((meter) => {
              const locked = submittedReadings[meter.id] !== undefined;
              const previousReading = locked
                ? (submittedPreviousReadings[meter.id] ?? meter.baselineReading)
                : meter.previousReading;
              const currentValue = locked ? submittedReadings[meter.id] : parsedValues[meter.id];

              return {
                meter,
                locked,
                value: values[meter.id] ?? "",
                previousReading,
                consumption: calculateConsumption(previousReading, currentValue ?? null),
              };
            }),
          );

          return (
            <AddressReadingBlock
              key={group.address || `address-${index}`}
              address={group.address}
              panelId={`address-panel-${index}`}
              types={group.types}
              rows={rows}
              monthLabel={monthLabel}
              onValueChange={handleValueChange}
            />
          );
        })}

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

        {showWhatsappSend ? (
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

      {error ? (
        <FeedbackToast
          message={error}
          variant="error"
          onDismiss={() => setError(null)}
        />
      ) : null}
    </div>
  );
}
