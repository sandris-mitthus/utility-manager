function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseStoredDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const displayMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (displayMatch) {
    const day = Number(displayMatch[1]);
    const month = Number(displayMatch[2]);
    const year = Number(displayMatch[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateDisplay(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const date = parseStoredDate(value);
  if (!date) {
    return "—";
  }

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatDateTimeDisplay(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return `${formatDateDisplay(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isoToDisplayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso;
  }

  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function parseDisplayDateToIso(value: string): string | null {
  const date = parseStoredDate(value);
  if (!date) {
    return null;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function sanitizeDisplayDateInput(value: string): string {
  return value.replace(/[^\d.]/g, "").slice(0, 10);
}

export function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
