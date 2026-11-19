"use client";

import { useMemo, useState } from "react";
import { MeterAddressModal } from "@/app/components/admin/meter-address-modal";
import { MeterFormModal } from "@/app/components/admin/meter-form-modal";
import {
  createEmptyMeter,
  useAdminData,
} from "@/app/components/admin-data-provider";
import {
  FeedbackToast,
  type FeedbackToastVariant,
} from "@/app/components/ui/feedback-toast";
import {
  cardClassName,
  primaryButtonClassName,
  tableClassName,
} from "@/app/components/ui/form-styles";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import { IconInput } from "@/app/components/ui/icon-input";
import {
  IconHash,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/app/components/ui/icons";
import { TableEmptyRow } from "@/app/components/ui/table-empty-row";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { formatMeterTypeLabel, formatReading, normalizeLookup } from "@/app/lib/utility/helpers";
import { formatDateDisplay } from "@/app/lib/format-date";
import type { UtilityMeter } from "@/app/lib/utility/types";

const VISIBLE_LIMIT = 200;

export function AdminMetersTab() {
  const { state, deleteMeter } = useAdminData();
  const [draft, setDraft] = useState<UtilityMeter | null>(null);
  const [addressMeter, setAddressMeter] = useState<UtilityMeter | null>(null);
  const [meterToDelete, setMeterToDelete] = useState<UtilityMeter | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    variant: FeedbackToastVariant;
  } | null>(null);
  const [query, setQuery] = useState("");

  function openCreateForm() {
    setDraft(createEmptyMeter());
  }

  function openEditForm(meter: UtilityMeter) {
    setDraft({ ...meter });
  }

  function closeForm() {
    setDraft(null);
  }

  async function confirmDeleteMeter() {
    if (!meterToDelete) {
      return;
    }

    const result = await deleteMeter(meterToDelete.id);
    if (!result.ok) {
      setFeedback({ message: result.message, variant: "error" });
      return;
    }

    setMeterToDelete(null);
    setFeedback({ message: "Skaitītājs dzēsts.", variant: "success" });
  }

  const isExistingMeter = draft
    ? state.meters.some((meter) => meter.id === draft.id)
    : false;
  const clientById = useMemo(
    () => new Map(state.clients.map((client) => [client.id, client])),
    [state.clients],
  );
  const filteredMeters = useMemo(() => {
    const normalized = normalizeLookup(query);
    if (!normalized) {
      return state.meters;
    }

    return state.meters.filter((meter) => {
      const client = clientById.get(meter.clientId);
      const haystack = normalizeLookup(
        [
          meter.number,
          meter.typeCode,
          formatMeterTypeLabel(meter),
          meter.address,
          meter.location,
          client?.clientNumber ?? "",
          client?.name ?? "",
          client?.address ?? "",
        ].join(" "),
      );
      return haystack.includes(normalized);
    });
  }, [clientById, query, state.meters]);
  const visibleMeters = filteredMeters.slice(0, VISIBLE_LIMIT);

  return (
    <div className="space-y-6">
      <div className={`${cardClassName} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Skaitītāji</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pārvaldiet skaitītāju numurus, tipus, derīguma termiņus un pēdējos rādījumus
          </p>
        </div>
        <button type="button" className={primaryButtonClassName} onClick={openCreateForm}>
          <IconPlus />
          Pievienot
        </button>
      </div>

      <div className={`${cardClassName} overflow-x-auto`}>
        <IconInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Meklēt pēc numura, koda, adreses vai klienta"
          icon={<IconHash className="size-4" />}
          wrapperClassName="mb-4"
        />
        {state.meters.length > 0 ? (
          <p className="mb-3 text-sm text-zinc-500">
            Rāda {visibleMeters.length} no {filteredMeters.length}
            {filteredMeters.length > visibleMeters.length
              ? ". Sašauriniet meklēšanu, lai redzētu pārējos."
              : ""}
          </p>
        ) : null}
        <table className={tableClassName}>
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Numurs</th>
              <th className="px-3 py-2 font-medium">Klients</th>
              <th className="px-3 py-2 font-medium">Darbības</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {state.meters.length === 0 ? (
              <TableEmptyRow
                colSpan={3}
                message="Nav skaitītāju. Pievienojiet pirmo ierakstu ar pogu Pievienot."
              />
            ) : visibleMeters.length === 0 ? (
              <TableEmptyRow colSpan={3} message="Nav skaitītāju, kas atbilst meklēšanai." />
            ) : (
              visibleMeters.map((meter) => {
              const client = clientById.get(meter.clientId);
              return (
                <tr key={meter.id}>
                  <td className="px-3 py-3">
                    <span className="block font-medium text-zinc-900">{meter.number}</span>
                    <span className="block text-sm text-zinc-500">
                      {formatMeterTypeLabel(meter)}
                    </span>
                    <span className="block text-sm text-zinc-500">
                      Derīgums {formatDateDisplay(meter.validUntil || meter.verificationDate)}
                    </span>
                    <span className="block text-sm text-zinc-500">
                      Rādījums {formatReading(meter.previousReading)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    {client ? (
                      <>
                        <span className="block font-medium text-zinc-900">
                          {meter.address || client.address}
                        </span>
                        {client.name ? (
                          <span className="block text-zinc-500">{client.name}</span>
                        ) : null}
                        <span className="block text-zinc-500">{client.clientNumber}</span>
                        {meter.location ? (
                          <span className="block text-sm text-zinc-500">{meter.location}</span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="block text-zinc-500">—</span>
                        {meter.location ? (
                          <span className="block text-sm text-zinc-500">{meter.location}</span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <TooltipIconButton
                        tooltip="Piesaistīt adresi skaitītājam"
                        icon={<IconMapPin />}
                        variant="secondary"
                        onClick={() => setAddressMeter(meter)}
                      />
                      <TooltipIconButton
                        tooltip="Labot skaitītāja datus"
                        icon={<IconPencil />}
                        variant="secondary"
                        onClick={() => openEditForm(meter)}
                      />
                      <TooltipIconButton
                        tooltip="Dzēst skaitītāju"
                        icon={<IconTrash />}
                        variant="danger"
                        onClick={() => setMeterToDelete(meter)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      {draft ? (
        <MeterFormModal meter={draft} isExisting={isExistingMeter} onClose={closeForm} />
      ) : null}

      {addressMeter ? (
        <MeterAddressModal meter={addressMeter} onClose={() => setAddressMeter(null)} />
      ) : null}

      {meterToDelete ? (
        <ConfirmCloseDialog
          title="Dzēst skaitītāju?"
          message={`Vai tiešām vēlaties dzēst skaitītāju ${meterToDelete.number}? Šo darbību nevar atsaukt.`}
          confirmLabel="Dzēst"
          confirmVariant="danger"
          onConfirm={confirmDeleteMeter}
          onCancel={() => setMeterToDelete(null)}
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
