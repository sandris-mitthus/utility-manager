"use client";

import { useMemo, useState } from "react";
import { ClientFormModal } from "@/app/components/admin/client-form-modal";
import { ClientMetersModal } from "@/app/components/admin/client-meters-modal";
import {
  createEmptyClient,
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
  IconCopy,
  IconGauge,
  IconHash,
  IconLink,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/app/components/ui/icons";
import { TableEmptyRow } from "@/app/components/ui/table-empty-row";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { buildClientReadingUrl } from "@/app/lib/utility/client-reading-url";
import { normalizeLookup } from "@/app/lib/utility/helpers";
import type { UtilityClient } from "@/app/lib/utility/types";

const VISIBLE_LIMIT = 200;

export function AdminClientsTab() {
  const { state, deleteClient } = useAdminData();
  const [draft, setDraft] = useState<UtilityClient | null>(null);
  const [metersClient, setMetersClient] = useState<UtilityClient | null>(null);
  const [clientToDelete, setClientToDelete] = useState<UtilityClient | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    variant: FeedbackToastVariant;
  } | null>(null);
  const [query, setQuery] = useState("");

  function openCreateForm() {
    setDraft(createEmptyClient());
  }

  function openEditForm(client: UtilityClient) {
    setDraft({ ...client });
  }

  function closeForm() {
    setDraft(null);
  }

  function openClientReadingForm(client: UtilityClient) {
    if (!client.publicToken) {
      return;
    }

    window.open(buildClientReadingUrl(client.publicToken), "_blank", "noopener,noreferrer");
  }

  async function copyClientReadingLink(client: UtilityClient) {
    if (!client.publicToken) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildClientReadingUrl(client.publicToken));
      setFeedback({ message: "Rādījumu saite nokopēta starpliktuvē.", variant: "success" });
    } catch {
      setFeedback({ message: "Neizdevās nokopēt saiti.", variant: "error" });
    }
  }

  async function confirmDeleteClient() {
    if (!clientToDelete) {
      return;
    }

    const result = await deleteClient(clientToDelete.id);
    if (!result.ok) {
      setFeedback({ message: result.message, variant: "error" });
      return;
    }

    setClientToDelete(null);
    setFeedback({ message: "Klients dzēsts.", variant: "success" });
  }

  const isExistingClient = draft
    ? state.clients.some((client) => client.id === draft.id)
    : false;
  const addressesByClientId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const meter of state.meters) {
      const address = meter.address.trim();
      if (!meter.clientId || !address) {
        continue;
      }
      const current = map.get(meter.clientId) ?? [];
      if (!current.includes(address)) {
        current.push(address);
      }
      map.set(meter.clientId, current);
    }
    return map;
  }, [state.meters]);
  const filteredClients = useMemo(() => {
    const normalized = normalizeLookup(query);
    if (!normalized) {
      return state.clients;
    }

    return state.clients.filter((client) => {
      const addresses = addressesByClientId.get(client.id) ?? [client.address];
      const haystack = normalizeLookup(
        [
          client.clientNumber,
          client.name,
          client.address,
          client.email,
          client.phone,
          client.phoneExtra,
          client.extraCode,
          ...addresses,
        ].join(" "),
      );
      return haystack.includes(normalized);
    });
  }, [addressesByClientId, query, state.clients]);
  const visibleClients = filteredClients.slice(0, VISIBLE_LIMIT);

  return (
    <div className="space-y-6">
      <div className={`${cardClassName} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Klienti</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pārvaldiet klienta kodus, kontaktus un piesaistītos skaitītājus
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
          placeholder="Meklēt pēc koda, vārda, adreses vai tālruņa"
          icon={<IconHash className="size-4" />}
          wrapperClassName="mb-4"
        />
        {state.clients.length > 0 ? (
          <p className="mb-3 text-sm text-zinc-500">
            Rāda {visibleClients.length} no {filteredClients.length}
            {filteredClients.length > visibleClients.length
              ? ". Sašauriniet meklēšanu, lai redzētu pārējos."
              : ""}
          </p>
        ) : null}
        <table className={tableClassName}>
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Kods</th>
              <th className="px-3 py-2 font-medium">Klients</th>
              <th className="px-3 py-2 font-medium">Kontakti</th>
              <th className="px-3 py-2 font-medium">Skaitītāji</th>
              <th className="px-3 py-2 font-medium">Darbības</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {state.clients.length === 0 ? (
              <TableEmptyRow
                colSpan={5}
                message="Nav klientu. Pievienojiet pirmo ierakstu ar pogu Pievienot."
              />
            ) : visibleClients.length === 0 ? (
              <TableEmptyRow colSpan={5} message="Nav klientu, kas atbilst meklēšanai." />
            ) : (
              visibleClients.map((client) => {
              const addresses = addressesByClientId.get(client.id) ?? [];
              const shownAddresses = addresses.length > 0 ? addresses : [client.address];
              return (
              <tr key={client.id}>
                <td className="px-3 py-3 font-medium text-zinc-900">
                  {client.clientNumber}
                  {client.extraCode ? (
                    <span className="mt-1 block text-sm font-normal text-zinc-500">
                      {client.extraCode}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-zinc-700">
                  {client.name ? <p className="font-medium text-zinc-900">{client.name}</p> : null}
                  {shownAddresses.slice(0, 3).map((address) => (
                    <p key={address} className="text-sm text-zinc-500">
                      {address}
                    </p>
                  ))}
                  {shownAddresses.length > 3 ? (
                    <p className="text-sm text-zinc-500">un vēl {shownAddresses.length - 3}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-sm text-zinc-700">
                  {client.email ? <p>{client.email}</p> : null}
                  {client.phone ? <p>{client.phone}</p> : null}
                  {client.phoneExtra ? <p>{client.phoneExtra}</p> : null}
                  {!client.email && !client.phone && !client.phoneExtra ? "—" : null}
                </td>
                <td className="px-3 py-3 text-zinc-700">{client.meterIds.length}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <TooltipIconButton
                      tooltip="Atvērt klienta rādījumu formu"
                      icon={<IconLink />}
                      variant="secondary"
                      onClick={() => openClientReadingForm(client)}
                      disabled={!client.publicToken}
                    />
                    <TooltipIconButton
                      tooltip="Kopēt rādījumu saiti klientam"
                      icon={<IconCopy />}
                      variant="secondary"
                      onClick={() => void copyClientReadingLink(client)}
                      disabled={!client.publicToken}
                    />
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
              );
              })
            )}
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
