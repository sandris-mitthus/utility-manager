"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  findClientByLookup,
  getClientMeters,
  hasSubmissionForMonth,
} from "@/app/lib/utility/helpers";
import { adminMutationHeaders } from "@/app/lib/security/admin-api";
import type {
  AdminContactSettings,
  ContactSettingsUpdate,
  UtilityClient,
  UtilityMeter,
  UtilityState,
} from "@/app/lib/utility/types";
import type { AdminUser } from "@/app/lib/auth/admin-types";
import { todayIsoDate } from "@/app/lib/format-date";

type AdminDataContextValue = {
  admin: AdminUser;
  csrfToken: string;
  state: UtilityState;
  reloadState: (month?: string) => Promise<void>;
  updateSettings: (
    settings: ContactSettingsUpdate,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  saveClient: (client: UtilityClient) => Promise<{ ok: true } | { ok: false; message: string }>;
  deleteClient: (clientId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  saveMeter: (meter: UtilityMeter) => Promise<{ ok: true } | { ok: false; message: string }>;
  deleteMeter: (meterId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  syncClientMeters: (
    clientId: string,
    meterIds: string[],
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  attachMeterToAddress: (
    meterId: string,
    clientId: string | null,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  hasSubmission: (clientId: string, month: string) => boolean;
};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

type AdminDataProviderProps = {
  children: ReactNode;
  admin: AdminUser;
  initialState: UtilityState;
  csrfToken: string;
};

async function readApiData<T>(
  response: Response,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const json = (await response.json()) as {
    success?: boolean;
    message?: string;
    data?: T;
  };

  if (!response.ok || !json.success) {
    return { ok: false, message: json.message || "Servera kļūda." };
  }

  if (json.data !== undefined) {
    return { ok: true, data: json.data };
  }

  return { ok: false, message: "Trūkst atjaunināto datu." };
}

function sortClients(clients: UtilityClient[]): UtilityClient[] {
  return [...clients].sort((left, right) =>
    left.clientNumber.localeCompare(right.clientNumber, "lv"),
  );
}

function sortMeters(meters: UtilityMeter[]): UtilityMeter[] {
  return [...meters].sort((left, right) => left.number.localeCompare(right.number, "lv"));
}

function upsertClientInState(current: UtilityState, client: UtilityClient): UtilityState {
  const exists = current.clients.some((item) => item.id === client.id);
  const clients = exists
    ? current.clients.map((item) => (item.id === client.id ? client : item))
    : [...current.clients, client];

  return { ...current, clients: sortClients(clients) };
}

function removeClientFromState(current: UtilityState, clientId: string): UtilityState {
  return {
    ...current,
    clients: current.clients.filter((client) => client.id !== clientId),
    meters: current.meters.filter((meter) => meter.clientId !== clientId),
    submissions: current.submissions.filter((submission) => submission.clientId !== clientId),
  };
}

function upsertMeterInState(current: UtilityState, meter: UtilityMeter): UtilityState {
  const exists = current.meters.some((item) => item.id === meter.id);
  const meters = exists
    ? current.meters.map((item) => (item.id === meter.id ? meter : item))
    : [...current.meters, meter];
  const clients = current.clients.map((client) => {
    const withoutMeter = client.meterIds.filter((id) => id !== meter.id);
    const meterIds =
      meter.clientId === client.id ? [...withoutMeter, meter.id] : withoutMeter;
    return { ...client, meterIds };
  });

  return { ...current, clients, meters: sortMeters(meters) };
}

function removeMeterFromState(current: UtilityState, meterId: string): UtilityState {
  return {
    ...current,
    clients: current.clients.map((client) => ({
      ...client,
      meterIds: client.meterIds.filter((id) => id !== meterId),
    })),
    meters: current.meters.filter((meter) => meter.id !== meterId),
  };
}

function syncClientMetersInState(
  current: UtilityState,
  clientId: string,
  meterIds: string[],
): UtilityState {
  const uniqueMeterIds = [...new Set(meterIds)];
  const selectedMeterIds = new Set(uniqueMeterIds);
  const clients = current.clients.map((client) => {
    if (client.id === clientId) {
      return { ...client, meterIds: uniqueMeterIds };
    }

    return {
      ...client,
      meterIds: client.meterIds.filter((id) => !selectedMeterIds.has(id)),
    };
  });
  const meters = current.meters.map((meter) => {
    if (selectedMeterIds.has(meter.id)) {
      return { ...meter, clientId };
    }
    if (meter.clientId === clientId) {
      return { ...meter, clientId: "" };
    }
    return meter;
  });

  return { ...current, clients, meters };
}

function attachMeterToClientInState(
  current: UtilityState,
  meterId: string,
  clientId: string | null,
): UtilityState {
  const nextClientId = clientId ?? "";
  const clients = current.clients.map((client) => {
    const withoutMeter = client.meterIds.filter((id) => id !== meterId);
    const meterIds =
      nextClientId === client.id ? [...withoutMeter, meterId] : withoutMeter;
    return { ...client, meterIds };
  });
  const meters = current.meters.map((meter) =>
    meter.id === meterId ? { ...meter, clientId: nextClientId } : meter,
  );

  return { ...current, clients, meters };
}

function replaceMonthSubmissionsInState(
  current: UtilityState,
  month: string,
  nextState: UtilityState,
): UtilityState {
  return {
    ...nextState,
    submissions: [
      ...current.submissions.filter((submission) => submission.month !== month),
      ...nextState.submissions,
    ],
  };
}

export function AdminDataProvider({
  children,
  admin,
  initialState,
  csrfToken,
}: AdminDataProviderProps) {
  const [state, setState] = useState<UtilityState>(initialState);
  const mutationHeaders = useCallback(() => adminMutationHeaders(csrfToken), [csrfToken]);

  const hasSubmission = useCallback(
    (clientId: string, month: string) => hasSubmissionForMonth(state, clientId, month),
    [state],
  );

  const reloadState = useCallback(async (month = todayIsoDate().slice(0, 7)) => {
    const response = await fetch(`/api/admin/data?month=${encodeURIComponent(month)}`, {
      headers: mutationHeaders(),
    });
    const json = (await response.json()) as {
      success?: boolean;
      data?: UtilityState;
    };

    if (response.ok && json.success && json.data) {
      setState((current) => replaceMonthSubmissionsInState(current, month, json.data!));
    }
  }, [mutationHeaders]);

  const updateSettings = useCallback(async (settings: ContactSettingsUpdate) => {
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: mutationHeaders(),
      body: JSON.stringify({
        email: settings.email,
        smsNumber: settings.smsNumber,
        whatsappNumber: settings.whatsappNumber,
        phoneNumber: settings.phoneNumber,
        imapHost: settings.imapHost,
        emailPassword: settings.emailPassword,
      }),
    });

    if (!response.ok) {
      const json = (await response.json()) as { message?: string };
      return { ok: false as const, message: json.message || "Neizdevās saglabāt iestatījumus." };
    }

    const json = (await response.json()) as { success: boolean; data: AdminContactSettings };
    setState((current) => ({ ...current, settings: json.data }));
    return { ok: true as const };
  }, [mutationHeaders]);

  const saveClient = useCallback(async (client: UtilityClient) => {
    const response = await fetch("/api/admin/clients", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify(client),
    });

    const result = await readApiData<UtilityClient>(response);
    if (!result.ok) {
      return result;
    }

    setState((current) => {
      const existingClient = current.clients.find((item) => item.id === result.data.id);
      return upsertClientInState(current, {
        ...result.data,
        meterIds: existingClient?.meterIds ?? [],
      });
    });
    return { ok: true as const };
  }, [mutationHeaders]);

  const deleteClient = useCallback(async (clientId: string) => {
    const response = await fetch(`/api/admin/clients?id=${encodeURIComponent(clientId)}`, {
      method: "DELETE",
      headers: mutationHeaders(),
    });

    const result = await readApiData<{ id: string }>(response);
    if (!result.ok) {
      return result;
    }

    setState((current) => removeClientFromState(current, result.data.id));
    return { ok: true as const };
  }, [mutationHeaders]);

  const saveMeter = useCallback(async (meter: UtilityMeter) => {
    const response = await fetch("/api/admin/meters", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify(meter),
    });

    const result = await readApiData<UtilityMeter>(response);
    if (!result.ok) {
      return result;
    }

    setState((current) => upsertMeterInState(current, result.data));
    return { ok: true as const };
  }, [mutationHeaders]);

  const deleteMeter = useCallback(async (meterId: string) => {
    const response = await fetch(`/api/admin/meters?id=${encodeURIComponent(meterId)}`, {
      method: "DELETE",
      headers: mutationHeaders(),
    });

    const result = await readApiData<{ id: string }>(response);
    if (!result.ok) {
      return result;
    }

    setState((current) => removeMeterFromState(current, result.data.id));
    return { ok: true as const };
  }, [mutationHeaders]);

  const syncClientMeters = useCallback(async (clientId: string, meterIds: string[]) => {
    const response = await fetch(`/api/admin/clients/${clientId}/meters`, {
      method: "PATCH",
      headers: mutationHeaders(),
      body: JSON.stringify({ meterIds }),
    });

    const result = await readApiData<{ clientId: string; meterIds: string[] }>(response);
    if (!result.ok) {
      return result;
    }

    setState((current) =>
      syncClientMetersInState(current, result.data.clientId, result.data.meterIds),
    );
    return { ok: true as const };
  }, [mutationHeaders]);

  const attachMeterToAddress = useCallback(async (meterId: string, clientId: string | null) => {
    const response = await fetch(`/api/admin/meters/${meterId}/client`, {
      method: "PATCH",
      headers: mutationHeaders(),
      body: JSON.stringify({ clientId }),
    });

    const result = await readApiData<{ meterId: string; clientId: string | null }>(response);
    if (!result.ok) {
      return result;
    }

    setState((current) =>
      attachMeterToClientInState(current, result.data.meterId, result.data.clientId),
    );
    return { ok: true as const };
  }, [mutationHeaders]);

  const value = useMemo(
    () => ({
      admin,
      csrfToken,
      state,
      reloadState,
      updateSettings,
      saveClient,
      deleteClient,
      saveMeter,
      deleteMeter,
      syncClientMeters,
      attachMeterToAddress,
      hasSubmission,
    }),
    [
      admin,
      csrfToken,
      state,
      reloadState,
      updateSettings,
      saveClient,
      deleteClient,
      saveMeter,
      deleteMeter,
      syncClientMeters,
      attachMeterToAddress,
      hasSubmission,
    ],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return context;
}

export function createEmptyClient(): UtilityClient {
  return {
    id: crypto.randomUUID(),
    clientNumber: "",
    address: "",
    meterIds: [],
  };
}

export function createEmptyMeter(clientId = ""): UtilityMeter {
  return {
    id: crypto.randomUUID(),
    number: "",
    type: "cold_water",
    verificationDate: todayIsoDate(),
    clientId,
    location: "",
    previousReading: 0,
    baselineReading: 0,
  };
}

export function findAdminClient(state: UtilityState, query: string) {
  return findClientByLookup(state.clients, query);
}

export function getAdminClientMeters(state: UtilityState, clientId: string) {
  return getClientMeters(state, clientId);
}
