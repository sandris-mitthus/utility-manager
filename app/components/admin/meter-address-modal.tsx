"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useDemoData } from "@/app/components/demo-data-provider";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui/form-styles";
import {
  IconLink,
  IconMinus,
  IconSave,
  IconX,
} from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { useModalKeyboard } from "@/app/components/ui/use-modal-keyboard";
import { METER_TYPE_LABELS, normalizeLookup } from "@/app/lib/demo/helpers";
import type { DemoClient, DemoMeter } from "@/app/lib/demo/types";

type MeterAddressModalProps = {
  meter: DemoMeter;
  onClose: () => void;
};

function clientMatchesQuery(client: DemoClient, query: string): boolean {
  const normalized = normalizeLookup(query);
  if (!normalized) {
    return false;
  }

  const haystack = normalizeLookup(`${client.clientNumber} ${client.address}`);
  return haystack.includes(normalized);
}

export function MeterAddressModal({ meter, onClose }: MeterAddressModalProps) {
  const { state, attachMeterToAddress } = useDemoData();
  const currentClient = state.clients.find((client) => client.id === meter.clientId) ?? null;

  const [query, setQuery] = useState("");
  const [hintsOpen, setHintsOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    meter.clientId || null,
  );
  const [confirmDetachOpen, setConfirmDetachOpen] = useState(false);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const initialClientId = meter.clientId || null;
  const hasUnsavedChanges = useMemo(() => {
    if (query.trim()) {
      return true;
    }

    return selectedClientId !== initialClientId;
  }, [query, selectedClientId, initialClientId]);

  const { confirmCloseOpen, requestBackdropClose, dismissConfirmClose, confirmClose } =
    useModalKeyboard({
      onClose,
      formRef,
      blockKeyboard: confirmDetachOpen,
      hasUnsavedChanges,
    });

  const selectedClient =
    state.clients.find((client) => client.id === selectedClientId) ?? null;

  const hints = useMemo(() => {
    if (!query.trim()) {
      return [];
    }

    return state.clients.filter((client) => clientMatchesQuery(client, query));
  }, [query, state.clients]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!inputWrapRef.current?.contains(event.target as Node)) {
        setHintsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectClient(client: DemoClient) {
    setSelectedClientId(client.id);
    setQuery("");
    setHintsOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClientId) {
      return;
    }
    attachMeterToAddress(meter.id, selectedClientId);
    onClose();
  }

  function handleDetach() {
    attachMeterToAddress(meter.id, null);
    onClose();
  }

  function confirmDetach() {
    setConfirmDetachOpen(false);
    handleDetach();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={requestBackdropClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meter-address-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h3 id="meter-address-modal-title" className="text-base font-semibold text-zinc-900">
              Piesaistīt adresi
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {meter.number} · {METER_TYPE_LABELS[meter.type]} · {meter.location}
            </p>
          </div>
          <TooltipIconButton
            tooltip="Aizvērt"
            icon={<IconX className="size-4" />}
            variant="none"
            tooltipPlacement="bottom"
            className="shrink-0"
            onClick={onClose}
          />
        </div>

        <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pt-5">
            {currentClient ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <p className="text-zinc-500">Pašreizējā adrese</p>
                <p className="font-medium text-zinc-900">{currentClient.address}</p>
                <p className="text-zinc-500">{currentClient.clientNumber}</p>
              </div>
            ) : null}

            <div ref={inputWrapRef}>
              <label htmlFor="meter-address-query" className={labelClassName}>
                Meklēt adresi
              </label>
              <input
                id="meter-address-query"
                type="text"
                value={query}
                autoComplete="off"
                placeholder="piem., Brīvības iela 1 vai K-12345"
                role="combobox"
                aria-expanded={hintsOpen && hints.length > 0}
                aria-controls="meter-address-hints"
                onFocus={() => setHintsOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHintsOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && hints[0]) {
                    event.preventDefault();
                    selectClient(hints[0]);
                  }
                }}
                className={`${inputClassName} mt-1`}
              />

              {hintsOpen && query.trim() ? (
                <ul
                  id="meter-address-hints"
                  role="listbox"
                  className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-sm"
                >
                  {hints.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-zinc-500">Nav atrastu adrešu</li>
                  ) : (
                    hints.map((client) => (
                      <li key={client.id} role="option">
                        <button
                          type="button"
                          onClick={() => selectClient(client)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                        >
                          <IconLink className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
                          <span>
                            <span className="block font-medium text-zinc-900">{client.address}</span>
                            <span className="block text-zinc-500">{client.clientNumber}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>

            {selectedClient ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <p className="text-emerald-800">Izvēlētā adrese piesaistīšanai</p>
                <p className="font-medium text-emerald-950">{selectedClient.address}</p>
                <p className="text-emerald-800">{selectedClient.clientNumber}</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                Ievadiet adresi vai klienta numuru un izvēlieties no hint saraksta.
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-100 px-6 py-4">
            <button
              type="submit"
              className={primaryButtonClassName}
              disabled={!selectedClientId}
            >
              <IconSave />
              Saglabāt
            </button>
            {currentClient ? (
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => setConfirmDetachOpen(true)}
              >
                <IconMinus />
                Noņemt adresi
              </button>
            ) : null}
            <button type="button" className={secondaryButtonClassName} onClick={onClose}>
              <IconX />
              Atcelt
            </button>
          </div>
        </form>
      </div>

      {confirmCloseOpen ? (
        <ConfirmCloseDialog onConfirm={confirmClose} onCancel={dismissConfirmClose} />
      ) : null}

      {confirmDetachOpen ? (
        <ConfirmCloseDialog
          title="Noņemt adresi?"
          message={`Vai tiešām vēlaties noņemt adresi no skaitītāja ${meter.number}?`}
          confirmLabel="Noņemt"
          confirmVariant="danger"
          onConfirm={confirmDetach}
          onCancel={() => setConfirmDetachOpen(false)}
        />
      ) : null}
    </div>
  );
}
