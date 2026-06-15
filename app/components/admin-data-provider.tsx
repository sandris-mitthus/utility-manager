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
} from "@/app/lib/demo/helpers";
import type {
  DemoClient,
  DemoContactSettings,
  DemoDataState,
  DemoMeter,
} from "@/app/lib/demo/types";
import { todayIsoDate } from "@/app/lib/format-date";

type AdminDataContextValue = {
  state: DemoDataState;
  updateSettings: (settings: DemoContactSettings) => Promise<{ ok: true } | { ok: false; message: string }>;
  saveClient: (client: DemoClient) => Promise<{ ok: true } | { ok: false; message: string }>;
  deleteClient: (clientId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  saveMeter: (meter: DemoMeter) => Promise<{ ok: true } | { ok: false; message: string }>;
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
  initialState: DemoDataState;
};

async function readApiState(response: Response): Promise<
  { ok: true; state: DemoDataState } | { ok: false; message: string }
> {
  const json = (await response.json()) as {
    success?: boolean;
    message?: string;
    state?: DemoDataState;
    data?: DemoContactSettings;
  };

  if (!response.ok || !json.success) {
    return { ok: false, message: json.message || "Servera kļūda." };
  }

  if (json.state) {
    return { ok: true, state: json.state };
  }

  return { ok: false, message: "Trūkst atjaunināto datu." };
}

export function AdminDataProvider({ children, initialState }: AdminDataProviderProps) {
  const [state, setState] = useState<DemoDataState>(initialState);

  const hasSubmission = useCallback(
    (clientId: string, month: string) => hasSubmissionForMonth(state, clientId, month),
    [state],
  );

  const updateSettings = useCallback(async (settings: DemoContactSettings) => {
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const json = (await response.json()) as { message?: string };
      return { ok: false as const, message: json.message || "Neizdevās saglabāt iestatījumus." };
    }

    const json = (await response.json()) as { success: boolean; data: DemoContactSettings };
    setState((current) => ({ ...current, settings: json.data }));
    return { ok: true as const };
  }, []);

  const saveClient = useCallback(async (client: DemoClient) => {
    const response = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(client),
    });

    const result = await readApiState(response);
    if (!result.ok) {
      return result;
    }

    setState(result.state);
    return { ok: true as const };
  }, []);

  const deleteClient = useCallback(async (clientId: string) => {
    const response = await fetch(`/api/admin/clients?id=${encodeURIComponent(clientId)}`, {
      method: "DELETE",
    });

    const result = await readApiState(response);
    if (!result.ok) {
      return result;
    }

    setState(result.state);
    return { ok: true as const };
  }, []);

  const saveMeter = useCallback(async (meter: DemoMeter) => {
    const response = await fetch("/api/admin/meters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meter),
    });

    const result = await readApiState(response);
    if (!result.ok) {
      return result;
    }

    setState(result.state);
    return { ok: true as const };
  }, []);

  const deleteMeter = useCallback(async (meterId: string) => {
    const response = await fetch(`/api/admin/meters?id=${encodeURIComponent(meterId)}`, {
      method: "DELETE",
    });

    const result = await readApiState(response);
    if (!result.ok) {
      return result;
    }

    setState(result.state);
    return { ok: true as const };
  }, []);

  const syncClientMeters = useCallback(async (clientId: string, meterIds: string[]) => {
    const response = await fetch(`/api/admin/clients/${clientId}/meters`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meterIds }),
    });

    const result = await readApiState(response);
    if (!result.ok) {
      return result;
    }

    setState(result.state);
    return { ok: true as const };
  }, []);

  const attachMeterToAddress = useCallback(async (meterId: string, clientId: string | null) => {
    const response = await fetch(`/api/admin/meters/${meterId}/client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });

    const result = await readApiState(response);
    if (!result.ok) {
      return result;
    }

    setState(result.state);
    return { ok: true as const };
  }, []);

  const value = useMemo(
    () => ({
      state,
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
      state,
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

export function createEmptyClient(): DemoClient {
  return {
    id: crypto.randomUUID(),
    clientNumber: "",
    address: "",
    meterIds: [],
  };
}

export function createEmptyMeter(clientId = ""): DemoMeter {
  return {
    id: crypto.randomUUID(),
    number: "",
    type: "cold_water",
    verificationDate: todayIsoDate(),
    clientId,
    location: "",
    previousReading: 0,
  };
}

export function findAdminClient(state: DemoDataState, query: string) {
  return findClientByLookup(state.clients, query);
}

export function getAdminClientMeters(state: DemoDataState, clientId: string) {
  return getClientMeters(state, clientId);
}
