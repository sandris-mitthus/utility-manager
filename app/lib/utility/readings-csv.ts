import { isoToDisplayDate } from "@/app/lib/format-date";
import { roundReading } from "@/app/lib/utility/helpers";
import type { UtilityClient, UtilityMeter, UtilitySubmission } from "@/app/lib/utility/types";

const READINGS_CSV_HEADER = [
  "Klienta kods",
  "Klients skaitītāju eksportā",
  "Adrese",
  "Skaitītāja tips",
  "Skaitītāja numurs",
  "Derīguma termiņš",
  "Pēdējais rādījums",
  "E-pasts (CUVc 58. lauks)",
  "Tālrunis (CUVc 15. lauks)",
  "Papildu tālrunis (CUVc 16. lauks)",
  "CUVc 146. lauks — pārbaudīt",
  "Rādījuma reģistrācijas datums",
  "Rādījuma perioda beigu datums",
  "Rādījuma ieraksta Nr.",
] as const;

function csvField(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function csvDate(value: string): string {
  if (!value) {
    return "";
  }
  const display = isoToDisplayDate(value);
  return display === value && !/^\d{2}\.\d{2}\.\d{4}$/.test(display) ? "" : display;
}

function csvReading(value: number): string {
  const rounded = roundReading(value);
  if (!Number.isFinite(rounded)) {
    return "";
  }
  return rounded.toFixed(3).replace(/\.?0+$/, "");
}

export function buildReadingsCsv(input: {
  clients: UtilityClient[];
  meters: UtilityMeter[];
  submissions: UtilitySubmission[];
  month: string;
}): string {
  const clientById = new Map(input.clients.map((client) => [client.id, client]));
  const submissionByClientId = new Map(
    input.submissions
      .filter((submission) => submission.month === input.month)
      .map((submission) => [submission.clientId, submission]),
  );

  const rows = input.meters
    .flatMap((meter) => {
      const client = clientById.get(meter.clientId);
      if (!client) {
        return [];
      }

      const submitted = submissionByClientId.get(client.id)?.readings[meter.id];
      if (submitted === undefined) {
        return [];
      }

      return [
        [
          client.clientNumber,
          client.name,
          meter.address || client.address,
          meter.typeCode,
          meter.number,
          csvDate(meter.validUntil || meter.verificationDate),
          csvReading(submitted),
          client.email,
          client.phone,
          client.phoneExtra,
          client.extraCode,
          csvDate(meter.readingRegisteredOn),
          csvDate(meter.readingPeriodEnd),
          meter.readingRecordNumber,
        ],
      ];
    })
    .sort((left, right) => {
      const code = left[0].localeCompare(right[0], "lv", { numeric: true });
      if (code !== 0) {
        return code;
      }
      const address = left[2].localeCompare(right[2], "lv");
      if (address !== 0) {
        return address;
      }
      const type = left[3].localeCompare(right[3], "lv");
      if (type !== 0) {
        return type;
      }
      return left[4].localeCompare(right[4], "lv", { numeric: true });
    });

  return [READINGS_CSV_HEADER.join(";"), ...rows.map((row) => row.map(csvField).join(";"))].join(
    "\r\n",
  );
}

export function downloadReadingsCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
