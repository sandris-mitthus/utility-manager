import { formatDateDisplay } from "@/app/lib/format-date";

const READING_TIME_ZONE = "Europe/Riga";

export type ReadingWindowStatus = {
  open: boolean;
  lastDays: number;
  /** Pirmā diena šomēnes, kad rādījumus drīkst nodot. Tukša, ja ierobežojuma nav. */
  startsOn: string;
  daysInMonth: number;
};

function rigaDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: READING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: read("year"), month: read("month"), day: read("day") };
}

export function normalizeReadingWindowDays(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(31, Math.max(0, Math.trunc(value)));
}

export function getReadingWindowStatus(lastDays: number, now = new Date()): ReadingWindowStatus {
  const days = normalizeReadingWindowDays(lastDays);
  const { year, month, day } = rigaDateParts(now);
  const daysInMonth = new Date(year, month, 0).getDate();

  if (days <= 0) {
    return { open: true, lastDays: 0, startsOn: "", daysInMonth };
  }

  const startDay = Math.max(1, daysInMonth - days + 1);
  const startsOn = `${year}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;

  return {
    open: day >= startDay,
    lastDays: days,
    startsOn,
    daysInMonth,
  };
}

export function readingWindowClosedMessage(status: ReadingWindowStatus): string {
  return `Rādījumus var nodot tikai pēdējās ${status.lastDays} mēneša dienas. Šomēnes tas ir no ${formatDateDisplay(status.startsOn)}.`;
}

export function readingWindowHint(lastDays: number, now = new Date()): string {
  const status = getReadingWindowStatus(lastDays, now);
  if (status.lastDays <= 0) {
    return "Rādījumus var nodot visu mēnesi.";
  }

  const start = formatDateDisplay(status.startsOn);
  if (status.open) {
    return `Rādījumus var nodot pēdējās ${status.lastDays} mēneša dienas. Šomēnes no ${start}.`;
  }

  return readingWindowClosedMessage(status);
}
