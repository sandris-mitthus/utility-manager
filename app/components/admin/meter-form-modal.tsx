"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAdminData } from "@/app/components/admin-data-provider";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import {
  FeedbackToast,
  type FeedbackToastVariant,
} from "@/app/components/ui/feedback-toast";
import { ActionButton } from "@/app/components/ui/action-button";
import {
  labelClassName,
  modalFooterClassName,
} from "@/app/components/ui/form-styles";
import { IconInput, IconSelect } from "@/app/components/ui/icon-input";
import {
  IconCalendar,
  IconChart,
  IconGauge,
  IconHome,
  IconLink,
  IconMapPin,
  IconSave,
  IconX,
} from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { useModalKeyboard } from "@/app/components/ui/use-modal-keyboard";
import { METER_TYPE_LABELS, normalizeLookup } from "@/app/lib/demo/helpers";
import {
  isoToDisplayDate,
  parseDisplayDateToIso,
  sanitizeDisplayDateInput,
} from "@/app/lib/format-date";
import { runPendingAction } from "@/app/lib/run-pending-action";
import type { DemoClient, DemoMeter, MeterType } from "@/app/lib/demo/types";

const METER_TYPES = Object.keys(METER_TYPE_LABELS) as MeterType[];

type MeterFormModalProps = {
  meter: DemoMeter;
  isExisting: boolean;
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

export function MeterFormModal({ meter, isExisting, onClose }: MeterFormModalProps) {
  const { state, saveMeter } = useAdminData();
  const [number, setNumber] = useState(meter.number);
  const [type, setType] = useState<MeterType>(meter.type);
  const [location, setLocation] = useState(meter.location);
  const [verificationDateDisplay, setVerificationDateDisplay] = useState(
    isoToDisplayDate(meter.verificationDate),
  );
  const [previousReading, setPreviousReading] = useState(meter.previousReading);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    isExisting ? meter.clientId || null : null,
  );
  const [addressQuery, setAddressQuery] = useState("");
  const [hintsOpen, setHintsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    variant: FeedbackToastVariant;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<"cancel" | "save" | null>(null);
  const isBusy = pendingAction !== null;
  const addressInputWrapRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const initialClientId = isExisting ? meter.clientId || null : null;
  const hasUnsavedChanges = useMemo(() => {
    if (addressQuery.trim()) {
      return true;
    }

    if (number.trim() !== meter.number.trim()) {
      return true;
    }

    if (type !== meter.type) {
      return true;
    }

    if (location.trim() !== meter.location.trim()) {
      return true;
    }

    if (verificationDateDisplay !== isoToDisplayDate(meter.verificationDate)) {
      return true;
    }

    if (previousReading !== meter.previousReading) {
      return true;
    }

    return selectedClientId !== initialClientId;
  }, [
    addressQuery,
    number,
    type,
    location,
    verificationDateDisplay,
    previousReading,
    selectedClientId,
    initialClientId,
    meter,
  ]);

  const { confirmCloseOpen, requestBackdropClose, dismissConfirmClose, confirmClose } =
    useModalKeyboard({ onClose, formRef, hasUnsavedChanges });

  const selectedClient =
    state.clients.find((client) => client.id === selectedClientId) ?? null;

  const addressHints = useMemo(() => {
    if (!addressQuery.trim()) {
      return [];
    }

    return state.clients.filter((client) => clientMatchesQuery(client, addressQuery));
  }, [addressQuery, state.clients]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!addressInputWrapRef.current?.contains(event.target as Node)) {
        setHintsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectClient(client: DemoClient) {
    setSelectedClientId(client.id);
    setAddressQuery("");
    setHintsOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNumber = number.trim();
    const trimmedLocation = location.trim();
    const verificationDate = parseDisplayDateToIso(verificationDateDisplay);
    if (!trimmedNumber || !trimmedLocation || !selectedClientId || !verificationDate) {
      return;
    }

    await runPendingAction("save", setPendingAction, async () => {
      const result = await saveMeter({
        ...meter,
        number: trimmedNumber,
        type,
        location: trimmedLocation,
        clientId: selectedClientId,
        verificationDate,
        previousReading,
      });

      if (!result.ok) {
        setFeedback({ message: result.message, variant: "error" });
        return;
      }

      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={requestBackdropClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meter-form-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h3 id="meter-form-modal-title" className="text-base font-semibold text-zinc-900">
              {isExisting ? "Labot skaitītāju" : "Jauns skaitītājs"}
            </h3>
            {isExisting ? (
              <p className="mt-1 text-sm text-zinc-500">
                Atjauniniet skaitītāja datus un piesaistīto adresi
              </p>
            ) : null}
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
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="meter-number" className={labelClassName}>
              Skaitītāja numurs
            </label>
            <IconInput
              id="meter-number"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="piem., HW-1001"
              icon={<IconGauge className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div>
            <label htmlFor="meter-type" className={labelClassName}>
              Veids
            </label>
            <IconSelect
              id="meter-type"
              value={type}
              onChange={(event) => setType(event.target.value as MeterType)}
              icon={<IconGauge className="size-4" />}
              wrapperClassName="mt-1"
            >
              {METER_TYPES.map((meterType) => (
                <option key={meterType} value={meterType}>
                  {METER_TYPE_LABELS[meterType]}
                </option>
              ))}
            </IconSelect>
          </div>
          <div ref={addressInputWrapRef}>
            <label htmlFor="meter-address-query" className={labelClassName}>
              Klients / adrese
            </label>
            <IconInput
              id="meter-address-query"
              type="text"
              value={addressQuery}
              autoComplete="off"
              placeholder="piem., Brīvības iela 1 vai 12345"
              role="combobox"
              aria-expanded={hintsOpen && addressHints.length > 0}
              aria-controls="meter-form-address-hints"
              onFocus={() => setHintsOpen(true)}
              onChange={(event) => {
                setAddressQuery(event.target.value);
                setHintsOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && addressHints[0]) {
                  event.preventDefault();
                  selectClient(addressHints[0]);
                }
              }}
              icon={<IconMapPin className="size-4" />}
              wrapperClassName="mt-1"
            />

            {hintsOpen && addressQuery.trim() ? (
              <ul
                id="meter-form-address-hints"
                role="listbox"
                className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-sm"
              >
                {addressHints.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-zinc-500">Nav atrastu adrešu</li>
                ) : (
                  addressHints.map((client) => (
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

            {selectedClient ? (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <p className="text-emerald-800">Izvēlētā adrese</p>
                <p className="font-medium text-emerald-950">{selectedClient.address}</p>
                <p className="text-emerald-800">{selectedClient.clientNumber}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                Ievadiet adresi vai klienta numuru un izvēlieties no hint saraksta.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="meter-location" className={labelClassName}>
              Atrašanās vieta
            </label>
            <IconInput
              id="meter-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="piem., Virtuve, Sanmezgls"
              icon={<IconHome className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div>
            <label htmlFor="meter-verification" className={labelClassName}>
              Verifikācijas datums
            </label>
            <IconInput
              id="meter-verification"
              type="text"
              inputMode="numeric"
              placeholder="DD.MM.YYYY"
              value={verificationDateDisplay}
              onChange={(event) =>
                setVerificationDateDisplay(sanitizeDisplayDateInput(event.target.value))
              }
              icon={<IconCalendar className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div>
            <label htmlFor="meter-previous" className={labelClassName}>
              Iepriekšējā perioda rādījums
            </label>
            <IconInput
              id="meter-previous"
              type="number"
              min="0"
              step="0.1"
              value={previousReading}
              onChange={(event) => setPreviousReading(Number(event.target.value))}
              placeholder="piem., 125.4"
              icon={<IconChart className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
        </div>
          </div>

          <div className={modalFooterClassName}>
          <ActionButton
            type="button"
            variant="secondary"
            loading={pendingAction === "cancel"}
            disabled={isBusy}
            icon={<IconX />}
            onClick={() => void runPendingAction("cancel", setPendingAction, onClose)}
          >
            Atcelt
          </ActionButton>
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
      </div>

      {confirmCloseOpen ? (
        <ConfirmCloseDialog onConfirm={confirmClose} onCancel={dismissConfirmClose} />
      ) : null}

      {feedback ? (
        <FeedbackToast
          message={feedback.message}
          variant={feedback.variant}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}
    </div>
  );
}
