"use client";

import { useState } from "react";
import { MeterAddressModal } from "@/app/components/admin/meter-address-modal";
import { MeterFormModal } from "@/app/components/admin/meter-form-modal";
import {
  createEmptyMeter,
  useDemoData,
} from "@/app/components/demo-data-provider";
import {
  cardClassName,
  primaryButtonClassName,
  tableClassName,
} from "@/app/components/ui/form-styles";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import {
  IconMapPin,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { METER_TYPE_LABELS } from "@/app/lib/demo/helpers";
import { formatDateDisplay } from "@/app/lib/format-date";
import type { DemoMeter } from "@/app/lib/demo/types";

export function AdminMetersTab() {
  const { state, deleteMeter } = useDemoData();
  const [draft, setDraft] = useState<DemoMeter | null>(null);
  const [addressMeter, setAddressMeter] = useState<DemoMeter | null>(null);
  const [meterToDelete, setMeterToDelete] = useState<DemoMeter | null>(null);

  function openCreateForm() {
    setDraft(createEmptyMeter());
  }

  function openEditForm(meter: DemoMeter) {
    setDraft({ ...meter });
  }

  function closeForm() {
    setDraft(null);
  }

  function confirmDeleteMeter() {
    if (!meterToDelete) {
      return;
    }

    deleteMeter(meterToDelete.id);
    setMeterToDelete(null);
  }

  const isExistingMeter = draft
    ? state.meters.some((meter) => meter.id === draft.id)
    : false;

  return (
    <div className="space-y-6">
      <div className={`${cardClassName} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Skaitītāji</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pārvaldiet skaitītāju numurus, verifikācijas datumus un atrašanās vietu
          </p>
        </div>
        <button type="button" className={primaryButtonClassName} onClick={openCreateForm}>
          <IconPlus />
          Pievienot
        </button>
      </div>

      <div className={`${cardClassName} overflow-x-auto`}>
        <table className={tableClassName}>
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Numurs</th>
              <th className="px-3 py-2 font-medium">Klients</th>
              <th className="px-3 py-2 font-medium">Darbības</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {state.meters.map((meter) => {
              const client = state.clients.find((item) => item.id === meter.clientId);
              return (
                <tr key={meter.id}>
                  <td className="px-3 py-3">
                    <span className="block font-medium text-zinc-900">{meter.number}</span>
                    <span className="block text-sm text-zinc-500">
                      {METER_TYPE_LABELS[meter.type]}
                    </span>
                    <span className="block text-sm text-zinc-500">
                      {formatDateDisplay(meter.verificationDate)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    {client ? (
                      <>
                        <span className="block font-medium text-zinc-900">{client.address}</span>
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
            })}
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
    </div>
  );
}
