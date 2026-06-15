"use client";

import { FormEvent, useMemo, useState } from "react";
import { FaqAccordion } from "@/app/components/faq-accordion";
import { useDemoData } from "@/app/components/demo-data-provider";
import { MeterReadingForm } from "@/app/components/meter-reading-form";
import {
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/app/components/ui/form-styles";
import { IconArrowRight } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { buildFaqItems } from "@/app/lib/demo/faq-items";
import type { DemoClient } from "@/app/lib/demo/types";

export function ContractLookupPanel() {
  const { state, findClient, getMetersForClient } = useDemoData();
  const [clientLookup, setClientLookup] = useState("");
  const [selectedClient, setSelectedClient] = useState<DemoClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  const faqItems = useMemo(() => buildFaqItems(state.settings), [state.settings]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = clientLookup.trim();
    if (!trimmed) {
      setError("Ievadiet klienta numuru vai adresi.");
      setSelectedClient(null);
      return;
    }

    const client = findClient(trimmed);
    if (!client) {
      setError("Klients nav atrasts. Demo: K-12345 vai Brīvības iela 1, Rīga.");
      setSelectedClient(null);
      return;
    }

    setError(null);
    setSelectedClient(client);
  }

  if (selectedClient) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <MeterReadingForm
          client={selectedClient}
          meters={getMetersForClient(selectedClient.id)}
          onBack={() => setSelectedClient(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className={cardClassName}>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-900">
            Ievadiet klienta numuru vai adresi
          </h2>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="client-lookup" className={labelClassName}>
              Klienta numurs vai adrese
            </label>
            <input
              id="client-lookup"
              name="clientLookup"
              type="text"
              inputMode="text"
              autoComplete="street-address"
              spellCheck={false}
              placeholder="piem., K-12345 vai Brīvības iela 1, Rīga"
              value={clientLookup}
              onChange={(event) => {
                setClientLookup(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "client-lookup-error" : "client-lookup-hint"}
              className={`${inputClassName} mt-2 ${
                error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""
              }`}
            />
            {error ? (
              <p id="client-lookup-error" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            ) : (
              <p id="client-lookup-hint" className="mt-2 text-center text-xs text-zinc-500">
                Demo dati: K-12345, K-67890, K-11111 vai atbilstoša adrese
              </p>
            )}
          </div>

          <TooltipIconButton
            tooltip="Turpināt uz skaitītāju rādījumu ievadi"
            icon={<IconArrowRight />}
            variant="primary"
            type="submit"
            className="w-full !px-3 !py-3"
          />
        </form>
      </div>

      <FaqAccordion
        items={faqItems}
        subtitle="Atbildes par klienta numuru, adresi un rādījumu iesniegšanu."
      />
    </div>
  );
}
