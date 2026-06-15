"use client";

import { FormEvent, useMemo, useState } from "react";
import { useDemoData } from "@/app/components/demo-data-provider";
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
} from "@/app/lib/demo/helpers";
import type { DemoClient, DemoMeter } from "@/app/lib/demo/types";

type MeterReadingFormProps = {
  client: DemoClient;
  meters: DemoMeter[];
  onBack: () => void;
};

export function MeterReadingForm({ client, meters, onBack }: MeterReadingFormProps) {
  const { submitReadings } = useDemoData();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

      const readings: Record<string, number> = {};
      for (const meter of meters) {
        const parsed = parsedValues[meter.id];
        if (parsed === null) {
          setError(`Ievadiet derīgu rādījumu skaitītājam ${meter.number}.`);
          return;
        }
        if (parsed < meter.previousReading) {
          setError(
            `Skaitītājam ${meter.number} rādījums nevar būt mazāks par iepriekšējo periodu (${formatReading(meter.previousReading)}).`,
          );
          return;
        }
        readings[meter.id] = parsed;
      }

      const result = submitReadings(client.id, readings);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setSuccess(true);
    });
  }

  if (success) {
    return (
      <div className={`${cardClassName} text-center`}>
        <h2 className="text-lg font-semibold text-zinc-900">Rādījumi iesniegti</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Paldies! Rādījumi klientam {client.clientNumber} ir saglabāti demo režīmā.
        </p>
        <TooltipIconButton
          tooltip="Atgriezties pie klienta meklēšanas"
          icon={<IconArrowLeft />}
          variant="primary"
          onClick={onBack}
          className="mt-6"
        />
      </div>
    );
  }

  if (meters.length === 0) {
    return (
      <div className={cardClassName}>
        <p className="text-sm text-zinc-600">Klientam nav piesaistītu skaitītāju.</p>
        <TooltipIconButton
          tooltip="Atgriezties pie klienta meklēšanas"
          icon={<IconArrowLeft />}
          variant="secondary"
          onClick={onBack}
          className="mt-4"
        />
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
                    Iepriekšējais rādījums:{" "}
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
