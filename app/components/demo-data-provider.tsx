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
  createId,
  findClientByLookup,
  getClientMeters,
  getCurrentMonthKey,
  hasSubmissionForMonth,
} from "@/app/lib/demo/helpers";
import { DEMO_SEED } from "@/app/lib/demo/seed-data";
import { todayIsoDate } from "@/app/lib/format-date";
import type {
  DemoClient,
  DemoContactSettings,
  DemoDataState,
  DemoMeter,
} from "@/app/lib/demo/types";

type DemoDataContextValue = {
  state: DemoDataState;
  findClient: (query: string) => DemoClient | null;
  getMetersForClient: (clientId: string) => DemoMeter[];
  submitReadings: (
    clientId: string,
    readings: Record<string, number>,
  ) => { ok: true } | { ok: false; message: string };
  updateSettings: (settings: DemoContactSettings) => void;
  saveClient: (client: DemoClient) => void;
  deleteClient: (clientId: string) => void;
  saveMeter: (meter: DemoMeter) => void;
  deleteMeter: (meterId: string) => void;
  syncClientMeters: (clientId: string, meterIds: string[]) => void;
  attachMeterToAddress: (meterId: string, clientId: string | null) => void;
  hasSubmission: (clientId: string, month: string) => boolean;
};

const DemoDataContext = createContext<DemoDataContextValue | null>(null);

type DemoDataProviderProps = {
  children: ReactNode;
  initialState?: DemoDataState;
};

export function DemoDataProvider({
  children,
  initialState = DEMO_SEED,
}: DemoDataProviderProps) {
  const [state, setState] = useState<DemoDataState>(initialState);

  const findClient = useCallback(
    (query: string) => findClientByLookup(state.clients, query),
    [state.clients],
  );

  const getMetersForClient = useCallback(
    (clientId: string) => getClientMeters(state, clientId),
    [state],
  );

  const hasSubmission = useCallback(
    (clientId: string, month: string) =>
      hasSubmissionForMonth(state, clientId, month),
    [state],
  );

  const submitReadings = useCallback(
    (
      clientId: string,
      readings: Record<string, number>,
    ): { ok: true } | { ok: false; message: string } => {
      const month = getCurrentMonthKey();
      const meters = getClientMeters(state, clientId);

      if (meters.length === 0) {
        return { ok: false, message: "Klientam nav piesaistītu skaitītāju." };
      }

      for (const meter of meters) {
        const current = readings[meter.id];
        if (current === undefined) {
          return {
            ok: false,
            message: `Ievadiet rādījumu visiem skaitītājiem (${meter.number}).`,
          };
        }
        if (current < meter.previousReading) {
          return {
            ok: false,
            message: `Skaitītājam ${meter.number} rādījums nevar būt mazāks par iepriekšējo periodu.`,
          };
        }
      }

      if (hasSubmissionForMonth(state, clientId, month)) {
        return {
          ok: false,
          message: "Rādījumi šim mēnesim jau ir iesniegti.",
        };
      }

      setState((current) => ({
        ...current,
        submissions: [
          ...current.submissions,
          {
            clientId,
            month,
            submittedAt: new Date().toISOString(),
            readings,
          },
        ],
        meters: current.meters.map((meter) => {
          const nextReading = readings[meter.id];
          if (meter.clientId !== clientId || nextReading === undefined) {
            return meter;
          }
          return { ...meter, previousReading: nextReading };
        }),
      }));

      return { ok: true };
    },
    [state],
  );

  const updateSettings = useCallback((settings: DemoContactSettings) => {
    setState((current) => ({ ...current, settings }));
  }, []);

  const saveClient = useCallback((client: DemoClient) => {
    setState((current) => {
      const exists = current.clients.some((item) => item.id === client.id);
      return {
        ...current,
        clients: exists
          ? current.clients.map((item) => (item.id === client.id ? client : item))
          : [...current.clients, client],
      };
    });
  }, []);

  const deleteClient = useCallback((clientId: string) => {
    setState((current) => ({
      ...current,
      clients: current.clients.filter((client) => client.id !== clientId),
      meters: current.meters.filter((meter) => meter.clientId !== clientId),
      submissions: current.submissions.filter(
        (submission) => submission.clientId !== clientId,
      ),
    }));
  }, []);

  const saveMeter = useCallback((meter: DemoMeter) => {
    setState((current) => {
      const exists = current.meters.some((item) => item.id === meter.id);
      const meters = exists
        ? current.meters.map((item) => (item.id === meter.id ? meter : item))
        : [...current.meters, meter];

      const client = current.clients.find((item) => item.id === meter.clientId);
      if (!client) {
        return { ...current, meters };
      }

      const meterIds = exists
        ? client.meterIds
        : client.meterIds.includes(meter.id)
          ? client.meterIds
          : [...client.meterIds, meter.id];

      return {
        ...current,
        meters,
        clients: current.clients.map((item) =>
          item.id === client.id ? { ...item, meterIds } : item,
        ),
      };
    });
  }, []);

  const deleteMeter = useCallback((meterId: string) => {
    setState((current) => ({
      ...current,
      meters: current.meters.filter((meter) => meter.id !== meterId),
      clients: current.clients.map((client) => ({
        ...client,
        meterIds: client.meterIds.filter((id) => id !== meterId),
      })),
    }));
  }, []);

  const syncClientMeters = useCallback((clientId: string, meterIds: string[]) => {
    setState((current) => {
      const uniqueMeterIds = [...new Set(meterIds)];

      return {
        ...current,
        meters: current.meters.map((meter) => {
          if (uniqueMeterIds.includes(meter.id)) {
            return { ...meter, clientId };
          }
          if (meter.clientId === clientId) {
            return { ...meter, clientId: "" };
          }
          return meter;
        }),
        clients: current.clients.map((client) =>
          client.id === clientId
            ? { ...client, meterIds: uniqueMeterIds }
            : {
                ...client,
                meterIds: client.meterIds.filter((id) => !uniqueMeterIds.includes(id)),
              },
        ),
      };
    });
  }, []);

  const attachMeterToAddress = useCallback((meterId: string, clientId: string | null) => {
    setState((current) => {
      const meter = current.meters.find((item) => item.id === meterId);
      if (!meter) {
        return current;
      }

      const nextClientId = clientId ?? "";

      return {
        ...current,
        meters: current.meters.map((item) =>
          item.id === meterId ? { ...item, clientId: nextClientId } : item,
        ),
        clients: current.clients.map((client) => {
          const meterIds = client.meterIds.filter((id) => id !== meterId);
          if (nextClientId && client.id === nextClientId) {
            return { ...client, meterIds: [...meterIds, meterId] };
          }
          return { ...client, meterIds };
        }),
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      findClient,
      getMetersForClient,
      submitReadings,
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
      findClient,
      getMetersForClient,
      submitReadings,
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

  return (
    <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>
  );
}

export function useDemoData() {
  const context = useContext(DemoDataContext);
  if (!context) {
    throw new Error("useDemoData must be used within DemoDataProvider");
  }
  return context;
}

export function createEmptyClient(): DemoClient {
  return {
    id: createId("client"),
    clientNumber: "",
    address: "",
    meterIds: [],
  };
}

export function createEmptyMeter(clientId = ""): DemoMeter {
  return {
    id: createId("meter"),
    number: "",
    type: "cold_water",
    verificationDate: todayIsoDate(),
    clientId,
    location: "",
    previousReading: 0,
  };
}
