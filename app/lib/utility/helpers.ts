import type { UtilityClient, UtilityMeter, UtilityState, MeterType } from "@/app/lib/utility/types";

export const READING_DECIMAL_PLACES = 3;

export const METER_TYPE_LABELS: Record<MeterType, string> = {
  hot_water: "Karstais ūdens",
  cold_water: "Aukstais ūdens",
  sewage: "Kanalizācija",
  heating: "Apkure",
};

/** Public reading form: cold water, hot water, sewage, then heating. */
export const METER_TYPE_ORDER: MeterType[] = ["cold_water", "hot_water", "sewage", "heating"];

export type ReadingFormTypeGroup = {
  type: MeterType;
  meters: UtilityMeter[];
};

export type ReadingFormAddressGroup = {
  address: string;
  types: ReadingFormTypeGroup[];
};

export function meterReadingAddress(
  meter: Pick<UtilityMeter, "address">,
  clientAddress: string,
): string {
  return meter.address.trim() || clientAddress.trim();
}

/** Sort by address, then meter type, then number. Group so the form can separate types inside each address. */
export function groupMetersForReadingForm(
  meters: UtilityMeter[],
  clientAddress: string,
): ReadingFormAddressGroup[] {
  const sorted = [...meters].sort((left, right) => {
    const addressCompare = meterReadingAddress(left, clientAddress).localeCompare(
      meterReadingAddress(right, clientAddress),
      "lv",
    );
    if (addressCompare !== 0) {
      return addressCompare;
    }

    const typeCompare = METER_TYPE_ORDER.indexOf(left.type) - METER_TYPE_ORDER.indexOf(right.type);
    if (typeCompare !== 0) {
      return typeCompare;
    }

    return left.number.localeCompare(right.number, "lv", { numeric: true });
  });

  const groups: ReadingFormAddressGroup[] = [];
  for (const meter of sorted) {
    const address = meterReadingAddress(meter, clientAddress);
    let addressGroup = groups[groups.length - 1];
    if (!addressGroup || addressGroup.address !== address) {
      addressGroup = { address, types: [] };
      groups.push(addressGroup);
    }

    let typeGroup = addressGroup.types[addressGroup.types.length - 1];
    if (!typeGroup || typeGroup.type !== meter.type) {
      typeGroup = { type: meter.type, meters: [] };
      addressGroup.types.push(typeGroup);
    }

    typeGroup.meters.push(meter);
  }

  return groups;
}

export function formatMeterTypeLabel(meter: Pick<UtilityMeter, "type" | "typeCode">): string {
  const label = METER_TYPE_LABELS[meter.type];
  return meter.typeCode ? `${label} (${meter.typeCode})` : label;
}

export function roundReading(value: number): number {
  const factor = 10 ** READING_DECIMAL_PLACES;
  return Math.round(value * factor) / factor;
}

export function normalizeLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findClientByLookup(
  clients: UtilityClient[],
  query: string,
): UtilityClient | null {
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

export function getClientMeters(state: Pick<UtilityState, "meters">, clientId: string): UtilityMeter[] {
  return state.meters.filter((meter) => meter.clientId === clientId);
}

export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
  return roundReading(value).toLocaleString("lv-LV", {
    minimumFractionDigits: 0,
    maximumFractionDigits: READING_DECIMAL_PLACES,
  });
}

export function sanitizeReadingInput(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, "");
  const separatorIndex = cleaned.search(/[.,]/);
  if (separatorIndex === -1) {
    return cleaned;
  }

  const integerPart = cleaned.slice(0, separatorIndex);
  const decimalPart = cleaned
    .slice(separatorIndex + 1)
    .replace(/[^\d]/g, "")
    .slice(0, READING_DECIMAL_PLACES);
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

  return roundReading(parsed);
}

export function calculateConsumption(
  previousReading: number,
  currentReading: number | null,
): number | null {
  if (currentReading === null || currentReading < previousReading) {
    return null;
  }

  return roundReading(currentReading - previousReading);
}

export function hasSubmissionForMonth(
  state: Pick<UtilityState, "submissions">,
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
