"use client";

import { useEffect, useState } from "react";
import { usePublicData } from "@/app/components/public-data-provider";
import { MeterReadingForm } from "@/app/components/meter-reading-form";
import { ActionButton } from "@/app/components/ui/action-button";
import { cardClassName } from "@/app/components/ui/form-styles";
import { IconArrowLeft } from "@/app/components/ui/icons";
import type { PublicLookupResult } from "@/app/lib/utility/types";

type ClientDirectReadingPanelProps = {
  token: string;
};

export function ClientDirectReadingPanel({ token }: ClientDirectReadingPanelProps) {
  const { lookupClientByToken } = usePublicData();
  const [lookupResult, setLookupResult] = useState<PublicLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      const result = await lookupClientByToken(token);
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setLookupResult(null);
        setError(result.message);
        setLoading(false);
        return;
      }

      setLookupResult(result.data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [lookupClientByToken, token]);

  if (loading) {
    return (
      <div className={`${cardClassName} mx-auto w-full max-w-xl text-center text-sm text-zinc-600`}>
        Ielādējam rādījumu formu…
      </div>
    );
  }

  if (error || !lookupResult) {
    return (
      <div className={`${cardClassName} mx-auto w-full max-w-xl text-center`}>
        <h2 className="text-lg font-semibold text-zinc-900">Saite nav derīga</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {error ?? "Neizdevās atvērt klienta rādījumu formu."}
        </p>
        <ActionButton
          type="button"
          variant="primary"
          onClick={() => {
            window.location.href = "/";
          }}
          icon={<IconArrowLeft />}
          className="mt-6"
        >
          Uz sākumu
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <MeterReadingForm
        client={lookupResult.client}
        meters={lookupResult.meters}
        submissionToken={lookupResult.submissionToken}
        hasSubmissionThisMonth={lookupResult.hasSubmissionThisMonth}
        onBack={() => {
          window.location.href = "/";
        }}
        onSubmissionComplete={() => {
          window.location.href = "/";
        }}
      />
    </div>
  );
}
