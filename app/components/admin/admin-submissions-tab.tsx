"use client";

import { useMemo, useState } from "react";
import { useDemoData } from "@/app/components/demo-data-provider";
import {
  cardClassName,
  secondaryButtonClassName,
  statusBadgeClassName,
  tableClassName,
} from "@/app/components/ui/form-styles";
import { IconAngleLeft, IconHome } from "@/app/components/ui/icons";
import {
  formatMonthLabel,
  formatMonthNameNominative,
  formatReading,
  getCurrentMonthKey,
  shiftMonthKey,
  METER_TYPE_LABELS,
} from "@/app/lib/demo/helpers";
import { formatDateTimeDisplay } from "@/app/lib/format-date";

export function AdminSubmissionsTab() {
  const { state, hasSubmission } = useDemoData();
  const currentMonth = getCurrentMonthKey();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const previousMonthKey = shiftMonthKey(selectedMonth, -1);
  const previousMonthLabel = formatMonthNameNominative(previousMonthKey);
  const isCurrentMonth = selectedMonth === currentMonth;

  const rows = useMemo(() => {
    return state.clients.map((client) => {
      const submitted = hasSubmission(client.id, selectedMonth);
      const submission = state.submissions.find(
        (item) => item.clientId === client.id && item.month === selectedMonth,
      );
      const meters = state.meters.filter((meter) => meter.clientId === client.id);

      return {
        client,
        submitted,
        submission,
        meters,
      };
    });
  }, [hasSubmission, selectedMonth, state.clients, state.meters, state.submissions]);

  const submittedRows = rows.filter((row) => row.submitted);
  const pendingRows = rows.filter((row) => !row.submitted);

  return (
    <div className="space-y-6">
      <div className={`${cardClassName} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Iesniegtie rādījumi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {formatMonthLabel(selectedMonth)}, iesnieguši {submittedRows.length} no{" "}
            {rows.length} klientiem
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => setSelectedMonth(previousMonthKey)}
          >
            <IconAngleLeft />
            {previousMonthLabel}
          </button>
          {!isCurrentMonth ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => setSelectedMonth(currentMonth)}
            >
              <IconHome />
              Šis mēnesis
            </button>
          ) : null}
        </div>
      </div>

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
    </div>
  );
}

type SubmissionRow = {
  client: {
    id: string;
    clientNumber: string;
    address: string;
  };
  submitted: boolean;
  submission?: {
    submittedAt: string;
    readings: Record<string, number>;
  };
  meters: Array<{
    id: string;
    number: string;
    type: keyof typeof METER_TYPE_LABELS;
    previousReading: number;
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
                  <td className="px-3 py-3 font-medium">{row.client.clientNumber}</td>
                  <td className="px-3 py-3">{row.client.address}</td>
                  <td className="px-3 py-3">
                    <span className={statusBadgeClassName(row.submitted)}>
                      {row.submitted ? "Iesniegts" : "Nav iesniegts"}
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
                        const consumption =
                          submittedReading === undefined
                            ? null
                            : submittedReading - meter.previousReading;

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
                                {formatReading(consumption ?? 0)} m³
                              </>
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
