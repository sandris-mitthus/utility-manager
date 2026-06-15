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
import { IconInput } from "@/app/components/ui/icon-input";
import { IconGauge, IconLink, IconSave, IconX } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { useModalKeyboard } from "@/app/components/ui/use-modal-keyboard";
import { METER_TYPE_LABELS, normalizeLookup } from "@/app/lib/demo/helpers";
import { runPendingAction } from "@/app/lib/run-pending-action";
import type { DemoClient, DemoMeter } from "@/app/lib/demo/types";

type ClientMetersModalProps = {
  client: DemoClient;
  onClose: () => void;
};

function meterMatchesQuery(meter: DemoMeter, query: string): boolean {
  const normalized = normalizeLookup(query);
  if (!normalized) {
    return false;
  }

  const haystack = normalizeLookup(
    `${meter.number} ${METER_TYPE_LABELS[meter.type]} ${meter.location}`,
  );
  return haystack.includes(normalized);
}

export function ClientMetersModal({ client, onClose }: ClientMetersModalProps) {
  const { state, syncClientMeters } = useAdminData();
  const [attachedIds, setAttachedIds] = useState<string[]>(client.meterIds);
  const [query, setQuery] = useState("");
  const [hintsOpen, setHintsOpen] = useState(false);
  const [meterToRemove, setMeterToRemove] = useState<DemoMeter | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    variant: FeedbackToastVariant;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<"cancel" | "save" | null>(null);
  const isBusy = pendingAction !== null;
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const hasUnsavedChanges = useMemo(() => {
    if (query.trim()) {
      return true;
    }

    const currentIds = [...attachedIds].sort().join(",");
    const initialIds = [...client.meterIds].sort().join(",");
    return currentIds !== initialIds;
  }, [query, attachedIds, client.meterIds]);

  const { confirmCloseOpen, requestBackdropClose, dismissConfirmClose, confirmClose } =
    useModalKeyboard({
      onClose,
      formRef,
      blockKeyboard: Boolean(meterToRemove),
      hasUnsavedChanges,
    });

  const attachedMeters = useMemo(
    () =>
      attachedIds
        .map((id) => state.meters.find((meter) => meter.id === id))
        .filter((meter): meter is DemoMeter => Boolean(meter)),
    [attachedIds, state.meters],
  );

  const hints = useMemo(() => {
    if (!query.trim()) {
      return [];
    }

    return state.meters.filter(
      (meter) => !attachedIds.includes(meter.id) && meterMatchesQuery(meter, query),
    );
  }, [attachedIds, query, state.meters]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!inputWrapRef.current?.contains(event.target as Node)) {
        setHintsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function addMeter(meterId: string) {
    setAttachedIds((current) => [...current, meterId]);
    setQuery("");
    setHintsOpen(false);
  }

  function removeMeter(meterId: string) {
    setAttachedIds((current) => current.filter((id) => id !== meterId));
  }

  function confirmRemoveMeter() {
    if (!meterToRemove) {
      return;
    }

    removeMeter(meterToRemove.id);
    setMeterToRemove(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runPendingAction("save", setPendingAction, async () => {
      const result = await syncClientMeters(client.id, attachedIds);
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
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-meters-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h3 id="client-meters-modal-title" className="text-base font-semibold text-zinc-900">
              Piesaistīt skaitītājus
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              <span className="block font-medium text-zinc-800">{client.address}</span>
              <span className="block">{client.clientNumber}</span>
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
            <div>
              <p className="text-sm font-medium text-zinc-700">Piesaistītie skaitītāji</p>
              {attachedMeters.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Vēl nav piesaistītu skaitītāju.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {attachedMeters.map((meter) => (
                    <li
                      key={meter.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                    >
                      <span className="text-zinc-800">
                        <span className="font-medium text-zinc-900">{meter.number}</span> ·{" "}
                        {METER_TYPE_LABELS[meter.type]} · {meter.location}
                      </span>
                      <TooltipIconButton
                        tooltip="Noņemt"
                        icon={<IconX />}
                        variant="danger"
                        onClick={() => setMeterToRemove(meter)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div ref={inputWrapRef}>
              <label htmlFor="client-meters-query" className={labelClassName}>
                Meklēt skaitītāju
              </label>
              <IconInput
                id="client-meters-query"
                type="text"
                value={query}
                autoComplete="off"
                placeholder="piem., HW-1001, Virtuve, Karstais ūdens"
                role="combobox"
                aria-expanded={hintsOpen && hints.length > 0}
                aria-controls="client-meters-hints"
                onFocus={() => setHintsOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHintsOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && hints[0]) {
                    event.preventDefault();
                    addMeter(hints[0].id);
                  }
                }}
                icon={<IconGauge className="size-4" />}
                wrapperClassName="mt-1"
              />

              {hintsOpen && query.trim() ? (
                <ul
                  id="client-meters-hints"
                  role="listbox"
                  className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-sm"
                >
                  {hints.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-zinc-500">Nav atrastu skaitītāju</li>
                  ) : (
                    hints.map((meter) => (
                      <li key={meter.id} role="option">
                        <button
                          type="button"
                          onClick={() => addMeter(meter.id)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                        >
                          <IconLink className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
                          <span>
                            <span className="block font-medium text-zinc-900">{meter.number}</span>
                            <span className="block text-zinc-500">
                              {METER_TYPE_LABELS[meter.type]} · {meter.location}
                              {meter.clientId && meter.clientId !== client.id
                                ? " · pie cita klienta"
                                : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
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

      {meterToRemove ? (
        <ConfirmCloseDialog
          title="Noņemt skaitītāju?"
          message={`Vai tiešām vēlaties noņemt skaitītāju ${meterToRemove.number} no šī klienta?`}
          confirmLabel="Noņemt"
          confirmVariant="danger"
          onConfirm={confirmRemoveMeter}
          onCancel={() => setMeterToRemove(null)}
        />
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
