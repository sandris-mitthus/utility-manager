"use client";

import { FormEvent, useMemo, useState } from "react";
import { FaqAccordion } from "@/app/components/faq-accordion";
import { usePublicData } from "@/app/components/public-data-provider";
import { MeterReadingForm } from "@/app/components/meter-reading-form";
import { ActionButton } from "@/app/components/ui/action-button";
import {
  cardClassName,
  labelClassName,
} from "@/app/components/ui/form-styles";
import { IconInput } from "@/app/components/ui/icon-input";
import { IconArrowRight, IconHash } from "@/app/components/ui/icons";
import { runPendingAction } from "@/app/lib/run-pending-action";
import { buildFaqItems } from "@/app/lib/utility/faq-items";
import { readingWindowHint } from "@/app/lib/utility/reading-window";
import type { PublicLookupResult } from "@/app/lib/utility/types";

export function ContractLookupPanel() {
  const { settings, lookupClient } = usePublicData();
  const [clientLookup, setClientLookup] = useState("");
  const [lookupResult, setLookupResult] = useState<PublicLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const faqItems = useMemo(() => buildFaqItems(settings), [settings]);

  const [pendingAction, setPendingAction] = useState<"submit" | null>(null);

  function resetLookup(clearInput = false) {
    setLookupResult(null);
    setError(null);
    if (clearInput) {
      setClientLookup("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void runPendingAction("submit", setPendingAction, async () => {
      const trimmed = clientLookup.trim();
      if (!trimmed) {
        setError("Ievadiet klienta kodu.");
        setLookupResult(null);
        return;
      }

      const result = await lookupClient(trimmed);
      if (!result.ok) {
        setError(result.message);
        setLookupResult(null);
        return;
      }

      setError(null);
      setLookupResult(result.data);
    });
  }

  if (lookupResult) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <MeterReadingForm
          client={lookupResult.client}
          meters={lookupResult.meters}
          submissionToken={lookupResult.submissionToken}
          submittedReadings={lookupResult.submittedReadings}
          submittedPreviousReadings={lookupResult.submittedPreviousReadings}
          onBack={() => resetLookup()}
          onSubmissionComplete={() => resetLookup(true)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className={cardClassName}>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-900">
            Ievadiet klienta kodu
          </h2>
          {settings.readingWindowDays > 0 ? (
            <p className="mt-2 text-sm text-zinc-500">{readingWindowHint(settings.readingWindowDays)}</p>
          ) : null}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="client-lookup" className={labelClassName}>
              Klienta kods
            </label>
            <IconInput
              id="client-lookup"
              name="clientLookup"
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="piem., 01012A"
              value={clientLookup}
              onChange={(event) => {
                setClientLookup(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "client-lookup-error" : undefined}
              icon={<IconHash className="size-4" />}
              wrapperClassName="mt-2"
              className={
                error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""
              }
            />
            {error ? (
              <p id="client-lookup-error" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}
          </div>

          <ActionButton
            type="submit"
            variant="primary"
            className="w-full !py-3"
            loading={pendingAction === "submit"}
            disabled={pendingAction !== null}
            icon={<IconArrowRight />}
          >
            Turpināt
          </ActionButton>
        </form>
      </div>

      <FaqAccordion
        items={faqItems}
        subtitle="Atbildes par klienta kodu un rādījumu iesniegšanu."
      />
    </div>
  );
}
