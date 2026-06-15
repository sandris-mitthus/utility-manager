"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type {
  PublicContactSettings,
  PublicLookupResult,
  PublicPageSettings,
} from "@/app/lib/utility/types";

type PublicDataContextValue = {
  settings: PublicContactSettings;
  lookupClient: (
    query: string,
  ) => Promise<{ ok: true; data: PublicLookupResult } | { ok: false; message: string }>;
  submitReadings: (
    clientId: string,
    submissionToken: string,
    readings: Record<string, number>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
};

const PublicDataContext = createContext<PublicDataContextValue | null>(null);

type PublicDataProviderProps = {
  children: ReactNode;
  initialSettings: PublicPageSettings;
};

export function PublicDataProvider({ children, initialSettings }: PublicDataProviderProps) {
  const settings = initialSettings.settings;

  const lookupClient = useCallback(async (query: string) => {
    const response = await fetch(`/api/public/lookup?q=${encodeURIComponent(query)}`);
    const json = (await response.json()) as {
      success?: boolean;
      message?: string;
      data?: PublicLookupResult;
    };

    if (!response.ok || !json.success || !json.data) {
      return { ok: false as const, message: json.message || "Klients nav atrasts." };
    }

    return { ok: true as const, data: json.data };
  }, []);

  const submitReadings = useCallback(
    async (
      clientId: string,
      submissionToken: string,
      readings: Record<string, number>,
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      const response = await fetch("/api/public/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, submissionToken, readings }),
      });

      const json = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !json.success) {
        return { ok: false, message: json.message || "Neizdevās iesniegt rādījumus." };
      }

      return { ok: true };
    },
    [],
  );

  const value = useMemo(
    () => ({
      settings,
      lookupClient,
      submitReadings,
    }),
    [settings, lookupClient, submitReadings],
  );

  return <PublicDataContext.Provider value={value}>{children}</PublicDataContext.Provider>;
}

export function usePublicData() {
  const context = useContext(PublicDataContext);
  if (!context) {
    throw new Error("usePublicData must be used within PublicDataProvider");
  }
  return context;
}
