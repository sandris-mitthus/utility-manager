"use client";

import { useState } from "react";
import { ClientFormModal } from "@/app/components/admin/client-form-modal";
import { ClientMetersModal } from "@/app/components/admin/client-meters-modal";
import {
  createEmptyClient,
  useDemoData,
} from "@/app/components/demo-data-provider";
import {
  cardClassName,
  primaryButtonClassName,
  tableClassName,
} from "@/app/components/ui/form-styles";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import {
  IconGauge,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import type { DemoClient } from "@/app/lib/demo/types";

export function AdminClientsTab() {
  const { state, deleteClient } = useDemoData();
  const [draft, setDraft] = useState<DemoClient | null>(null);
  const [metersClient, setMetersClient] = useState<DemoClient | null>(null);
  const [clientToDelete, setClientToDelete] = useState<DemoClient | null>(null);

  function openCreateForm() {
    setDraft(createEmptyClient());
  }

  function openEditForm(client: DemoClient) {
    setDraft({ ...client });
  }

  function closeForm() {
    setDraft(null);
  }

  function confirmDeleteClient() {
    if (!clientToDelete) {
      return;
    }

    deleteClient(clientToDelete.id);
    setClientToDelete(null);
  }

  const isExistingClient = draft
    ? state.clients.some((client) => client.id === draft.id)
    : false;

  return (
    <div className="space-y-6">
      <div className={`${cardClassName} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Klienti</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pārvaldiet klientu numurus, adreses un piesaistītos skaitītājus
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
              <th className="px-3 py-2 font-medium">Adrese</th>
              <th className="px-3 py-2 font-medium">Skaitītāji</th>
              <th className="px-3 py-2 font-medium">Darbības</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {state.clients.map((client) => (
              <tr key={client.id}>
                <td className="px-3 py-3 font-medium text-zinc-900">
                  {client.clientNumber}
                </td>
                <td className="px-3 py-3 text-zinc-700">{client.address}</td>
                <td className="px-3 py-3 text-zinc-700">{client.meterIds.length}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <TooltipIconButton
                      tooltip="Piesaistīt skaitītājus klientam"
                      icon={<IconGauge />}
                      variant="secondary"
                      onClick={() => setMetersClient(client)}
                    />
                    <TooltipIconButton
                      tooltip="Labot klienta datus"
                      icon={<IconPencil />}
                      variant="secondary"
                      onClick={() => openEditForm(client)}
                    />
                    <TooltipIconButton
                      tooltip="Dzēst klientu"
                      icon={<IconTrash />}
                      variant="danger"
                      onClick={() => setClientToDelete(client)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <ClientFormModal
          client={draft}
          isExisting={isExistingClient}
          onClose={closeForm}
        />
      ) : null}

      {metersClient ? (
        <ClientMetersModal client={metersClient} onClose={() => setMetersClient(null)} />
      ) : null}

      {clientToDelete ? (
        <ConfirmCloseDialog
          title="Dzēst klientu?"
          message={`Vai tiešām vēlaties dzēst klientu ${clientToDelete.clientNumber}? Šo darbību nevar atsaukt.`}
          confirmLabel="Dzēst"
          confirmVariant="danger"
          onConfirm={confirmDeleteClient}
          onCancel={() => setClientToDelete(null)}
        />
      ) : null}
    </div>
  );
}
