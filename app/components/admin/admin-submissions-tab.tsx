"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminData } from "@/app/components/admin-data-provider";
import { ActionButton } from "@/app/components/ui/action-button";
import {
  FeedbackToast,
  type FeedbackToastVariant,
} from "@/app/components/ui/feedback-toast";
import {
  cardClassName,
  secondaryButtonClassName,
  statusBadgeClassName,
  tableClassName,
} from "@/app/components/ui/form-styles";
import { IconAngleLeft, IconDownload, IconHome, IconRefresh, IconSend } from "@/app/components/ui/icons";
import { adminMutationHeaders } from "@/app/lib/security/admin-api";
import { runPendingAction } from "@/app/lib/run-pending-action";
import {
  calculateConsumption,
  formatMonthLabel,
  formatMonthNameNominative,
  formatReading,
  getCurrentMonthKey,
  shiftMonthKey,
  METER_TYPE_LABELS,
} from "@/app/lib/utility/helpers";
import { formatDateTimeDisplay } from "@/app/lib/format-date";
import { buildReadingsCsv, downloadReadingsCsv } from "@/app/lib/utility/readings-csv";

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

type GoogleSheetSyncResponse = {
  success: boolean;
  message?: string;
  data?: {
    syncedCount: number;
    spreadsheetUrl: string | null;
  };
};

export function AdminSubmissionsTab() {
  const { state, reloadState, csrfToken } = useAdminData();
  const currentMonth = getCurrentMonthKey();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(() => new Set([currentMonth]));
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"google-sheet" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const previousMonthKey = shiftMonthKey(selectedMonth, -1);
  const previousMonthLabel = formatMonthNameNominative(previousMonthKey);
  const isCurrentMonth = selectedMonth === currentMonth;

  const { rows, submittedRows, pendingRows, meterCount, submittedMeterCount } = useMemo(() => {
    const submissionByClientId = new Map(
      state.submissions
        .filter((submission) => submission.month === selectedMonth)
        .map((submission) => [submission.clientId, submission]),
    );
    const metersByClientId = new Map<string, SubmissionRow["meters"]>();
    for (const meter of state.meters) {
      const current = metersByClientId.get(meter.clientId) ?? [];
      current.push(meter);
      metersByClientId.set(meter.clientId, current);
    }

    const nextRows = state.clients.map((client) => {
      const submission = submissionByClientId.get(client.id);
      const meters = metersByClientId.get(client.id) ?? [];
      const submittedMeterCount = meters.filter(
        (meter) => submission?.readings[meter.id] !== undefined,
      ).length;
      const fullySubmitted = meters.length > 0 && submittedMeterCount === meters.length;

      return {
        client,
        submitted: fullySubmitted,
        partial: Boolean(submission) && !fullySubmitted,
        submission,
        meters,
      };
    });

    let meterCount = 0;
    let submittedMeterCount = 0;
    for (const row of nextRows) {
      meterCount += row.meters.length;
      submittedMeterCount += row.meters.filter(
        (meter) => row.submission?.readings[meter.id] !== undefined,
      ).length;
    }

    return {
      rows: nextRows,
      submittedRows: nextRows.filter((row) => row.submitted),
      pendingRows: nextRows.filter((row) => !row.submitted),
      meterCount,
      submittedMeterCount,
    };
  }, [selectedMonth, state.clients, state.meters, state.submissions]);
  const isBusy = pendingAction !== null;

  useEffect(() => {
    if (loadedMonths.has(selectedMonth)) {
      return;
    }

    let ignore = false;
    void reloadState(selectedMonth)
      .then(() => {
        if (!ignore) {
          setLoadedMonths((current) => new Set(current).add(selectedMonth));
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingMonth(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [loadedMonths, reloadState, selectedMonth]);
  const isLoadingSelectedMonth = loadingMonth === selectedMonth;

  function selectMonth(month: string) {
    if (!loadedMonths.has(month)) {
      setLoadingMonth(month);
    }
    setSelectedMonth(month);
  }

  function handleDownloadCsv() {
    const csv = buildReadingsCsv({
      clients: state.clients,
      meters: state.meters,
      submissions: state.submissions,
      month: selectedMonth,
    });
    downloadReadingsCsv(`radijumi-${selectedMonth}.csv`, csv);
  }

  async function handleSyncGoogleSheet() {
    await runPendingAction("google-sheet", setPendingAction, async () => {
      const response = await fetch("/api/admin/submissions/google-sheet", {
        method: "POST",
        headers: adminMutationHeaders(csrfToken),
        body: JSON.stringify({ month: selectedMonth }),
      });
      const json = (await response.json()) as GoogleSheetSyncResponse;

      if (!response.ok || !json.success || !json.data) {
        setFeedback({
          message: json.message || "Neizdevās atjaunot Google Sheet.",
          variant: "error",
        });
        return;
      }

      const suffix = json.data.spreadsheetUrl ? ` Fails: ${json.data.spreadsheetUrl}` : "";
      setFeedback({
        message: `Google Sheet atjaunots: ${json.data.syncedCount} ieraksti.${suffix}`,
        variant: "success",
      });
    });
  }

  return (
    <>
      {feedback ? (
        <FeedbackToast
          message={feedback.message}
          variant={feedback.variant}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}
      <div className="space-y-6">
      <div className={`${cardClassName} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Iesniegtie rādījumi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isLoadingSelectedMonth
              ? `${formatMonthLabel(selectedMonth)} tiek ielādēts...`
              : `${formatMonthLabel(selectedMonth)}, iesnieguši ${submittedRows.length} no ${rows.length} klientiem`}
          </p>
          {isLoadingSelectedMonth ? null : (
            <p className="mt-1 text-sm text-zinc-500">
              iesniegti {submittedMeterCount} no {meterCount} skaitītājiem
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            type="button"
            variant="secondary"
            icon={<IconRefresh />}
            loading={pendingAction === "google-sheet"}
            disabled={
              isBusy ||
              isLoadingSelectedMonth ||
              rows.every((row) => !row.submission)
            }
            onClick={handleSyncGoogleSheet}
          >
            Atjaunot Google Sheet
          </ActionButton>
          <div className="inline-flex">
            <button
              type="button"
              disabled={isBusy || isLoadingSelectedMonth || submittedMeterCount === 0}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-l-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconSend />
              Sūtīt
            </button>
            <button
              type="button"
              disabled={isBusy || isLoadingSelectedMonth || submittedMeterCount === 0}
              onClick={handleDownloadCsv}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-r-lg border border-l-0 border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconDownload />
              CSV
            </button>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={isBusy || isLoadingSelectedMonth}
            onClick={() => selectMonth(previousMonthKey)}
          >
            <IconAngleLeft />
            {previousMonthLabel}
          </button>
          {!isCurrentMonth ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={isBusy || isLoadingSelectedMonth}
              onClick={() => selectMonth(currentMonth)}
            >
              <IconHome />
              Šis mēnesis
            </button>
          ) : null}
        </div>
      </div>

      {state.clients.length === 0 ? (
        <section className={cardClassName}>
          <p className="text-sm text-zinc-500">
            Nav klientu, tāpēc šeit nebūs iesniegumu. Vispirms pievienojiet klientus cilnē
            Klienti.
          </p>
        </section>
      ) : (
        <>
          <SubmissionGroup
            title="Iesnieguši"
            emptyText="Šim mēnesim vēl nav iesniegumu."
            rows={submittedRows}
          />

          <SubmissionGroup
            title="Nav iesnieguši"
            emptyText="Visi klienti ir iesnieguši rādījumus."
            rows={pendingRows}
          />
        </>
      )}
    </div>
    </>
  );
}

type SubmissionRow = {
  client: {
    id: string;
    clientNumber: string;
    name: string;
    address: string;
  };
  submitted: boolean;
  partial: boolean;
  submission?: {
    submittedAt: string;
    readings: Record<string, number>;
    previousReadings?: Record<string, number>;
  };
  meters: Array<{
    id: string;
    number: string;
    type: keyof typeof METER_TYPE_LABELS;
    previousReading: number;
    baselineReading: number;
  }>;
};

function SubmissionGroup({
  title,
  emptyText,
  rows,
}: {
  title: string;
  emptyText: string;
  rows: SubmissionRow[];
}) {
  return (
    <section className={cardClassName}>
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{emptyText}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className={tableClassName}>
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="px-3 py-2 font-medium">Klients</th>
                <th className="px-3 py-2 font-medium">Adrese</th>
                <th className="px-3 py-2 font-medium">Statuss</th>
                <th className="px-3 py-2 font-medium">Skaitītāji</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => (
                <tr key={row.client.id} className="align-top text-zinc-800">
                  <td className="px-3 py-3">
                    {row.client.name ? (
                      <span className="block font-medium text-zinc-900">{row.client.name}</span>
                    ) : null}
                    <span className={row.client.name ? "block text-zinc-500" : "font-medium"}>
                      {row.client.clientNumber}
                    </span>
                  </td>
                  <td className="px-3 py-3">{row.client.address}</td>
                  <td className="px-3 py-3">
                    <span className={statusBadgeClassName(row.submitted)}>
                      {row.submitted
                        ? "Iesniegts"
                        : row.partial
                          ? "Daļēji iesniegts"
                          : "Nav iesniegts"}
                    </span>
                    {row.submission ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDateTimeDisplay(row.submission.submittedAt)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <ul className="space-y-2">
                      {row.meters.map((meter) => {
                        const submittedReading = row.submission?.readings[meter.id];
                        const baselineReading =
                          row.submission?.previousReadings?.[meter.id] ?? meter.baselineReading;
                        const consumption =
                          submittedReading === undefined || baselineReading === undefined
                            ? null
                            : calculateConsumption(baselineReading, submittedReading);

                        return (
                          <li key={meter.id} className="text-xs">
                            <span className="font-medium text-zinc-900">
                              {meter.number}
                            </span>{" "}
                            · {METER_TYPE_LABELS[meter.type]}
                            {submittedReading !== undefined ? (
                              <>
                                {" "}
                                · rādījums {formatReading(submittedReading)} · patēriņš{" "}
                                {consumption !== null ? `${formatReading(consumption)} m³` : "— m³"}
                              </>
                            ) : row.partial ? (
                              <> · nav iesniegts</>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
