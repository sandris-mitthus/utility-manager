import type { DemoClient, DemoDataState, DemoMeter, MeterType } from "@/app/lib/demo/types";

export const METER_TYPE_LABELS: Record<MeterType, string> = {
  hot_water: "Karstais ūdens",
  cold_water: "Aukstais ūdens",
  sewage: "Kanalizācija",
};

export function normalizeLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findClientByLookup(
  clients: DemoClient[],
  query: string,
): DemoClient | null {
  const normalized = normalizeLookup(query);
  if (!normalized) {
    return null;
  }

  return (
    clients.find((client) => {
      const numberMatch = normalizeLookup(client.clientNumber) === normalized;
      const addressMatch = normalizeLookup(client.address).includes(normalized);
      const reverseAddressMatch = normalized.includes(normalizeLookup(client.address));
      return numberMatch || addressMatch || reverseAddressMatch;
    }) ?? null
  );
}

export function getClientMeters(state: DemoDataState, clientId: string): DemoMeter[] {
  return state.meters.filter((meter) => meter.clientId === clientId);
}

export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getPreviousMonthKey(date = new Date()): string {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return getCurrentMonthKey(previous);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1 + delta, 1);
  return getCurrentMonthKey(date);
}

const MONTH_NAMES_NOMINATIVE = [
  "janvāris",
  "februāris",
  "marts",
  "aprīlis",
  "maijs",
  "jūnijs",
  "jūlijs",
  "augusts",
  "septembris",
  "oktobris",
  "novembris",
  "decembris",
] as const;

export function formatMonthNameNominative(monthKey: string): string {
  const [, month] = monthKey.split("-");
  const index = Number(month) - 1;
  const name = MONTH_NAMES_NOMINATIVE[index] ?? month;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const index = Number(month) - 1;
  return `${MONTH_NAMES_NOMINATIVE[index] ?? month} ${year}`;
}

export function formatReading(value: number): string {
  return value.toLocaleString("lv-LV", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function sanitizeReadingInput(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, "");
  const separatorIndex = cleaned.search(/[.,]/);
  if (separatorIndex === -1) {
    return cleaned;
  }

  const integerPart = cleaned.slice(0, separatorIndex);
  const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[^\d]/g, "");
  const separator = cleaned[separatorIndex] ?? ",";
  return `${integerPart}${separator}${decimalPart}`;
}

export function parseReadingInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function calculateConsumption(
  previousReading: number,
  currentReading: number | null,
): number | null {
  if (currentReading === null || currentReading < previousReading) {
    return null;
  }

  return Number((currentReading - previousReading).toFixed(1));
}

export function hasSubmissionForMonth(
  state: DemoDataState,
  clientId: string,
  month: string,
): boolean {
  return state.submissions.some(
    (submission) => submission.clientId === clientId && submission.month === month,
  );
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
