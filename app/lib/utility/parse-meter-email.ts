import type { ParsedEmailReading, ParsedMeterEmail } from "@/app/lib/utility/types";

/** Palielini, kad mainās parsēšanas loģika — vecie ieraksti tiks droši pārparsēti. */
export const EMAIL_PARSE_VERSION = 4;

const CLIENT_NUMBER_PATTERNS = [
  /(\d{2,6})\s*\(\s*klienta\s*nr\.?\s*\)/gi,
  /klienta\s*(?:nr\.?|numurs)\s*:?\s*(\d{2,6})/gi,
  /klienta\s*nr\.?\s+(\d{2,6})\b/gi,
  /\bkl\.?\s*nr\.?\s*\.?(\d{2,6})\b/gi,
  /\bklients?\s+(\d{2,6})\b/gi,
];

/** Skaitļi ar vadošajiem nullēm (00289,482) un tūkstošiem (802,375). */
const READING_NUMBER_CORE = "\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?";
const READING_NUMBER = `(?:${READING_NUMBER_CORE})`;
const READING_CAPTURE = `(${READING_NUMBER_CORE})`;

const READING_LABEL_ALIASES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /aukst(?:ais|a)?(?:\s*ud(?:ens)?)?/i, label: "Aukstais ūdens" },
  { pattern: /karst(?:ais|a)?(?:\s*ud(?:ens)?)?/i, label: "Karstais ūdens" },
  { pattern: /silt(?:ais|a)?/i, label: "Siltais ūdens" },
  { pattern: /kanalizacij/i, label: "Kanalizācija" },
  { pattern: /laistisanas|laistīšanas/i, label: "Laišanas ūdens" },
  { pattern: /ievadskaitit|ievadskaitīt/i, label: "Ievadskaitītājs" },
];

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseNumericToken(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/\s*m3\b/gi, "")
    .replace(/\s/g, "");
  if (!cleaned) {
    return null;
  }

  if (/^0+\d+,\d+$/.test(cleaned)) {
    const normalized = cleaned.replace(/^0+/, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  let normalized = cleaned;
  if (commaCount > 0 && dotCount > 0) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount === 1 && dotCount === 0) {
    const parts = cleaned.split(",");
    if (parts[1]?.length === 3 && parts[0].length > 3) {
      normalized = cleaned.replace(/,/g, "");
    } else {
      normalized = cleaned.replace(",", ".");
    }
  } else if (commaCount > 1) {
    normalized = cleaned.replace(/,/g, "");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function canonicalReadingLabel(rawLabel: string): string {
  const normalized = normalizeForMatch(rawLabel);
  for (const alias of READING_LABEL_ALIASES) {
    if (alias.pattern.test(normalized)) {
      return alias.label;
    }
  }
  return rawLabel.replace(/\s+/g, " ").trim();
}

function readingKey(reading: ParsedEmailReading): string {
  return [
    reading.meterNumber ?? "",
    reading.label ?? "",
    reading.previousValue ?? "",
    reading.currentValue,
  ].join("|");
}

function dedupeReadings(readings: ParsedEmailReading[]): ParsedEmailReading[] {
  const seen = new Set<string>();
  const result: ParsedEmailReading[] = [];

  const sorted = [...readings].sort((left, right) => {
    const leftScore =
      (left.meterNumber ? 4 : 0) + (left.label ? 2 : 0) + (left.previousValue !== undefined ? 1 : 0);
    const rightScore =
      (right.meterNumber ? 4 : 0) + (right.label ? 2 : 0) + (right.previousValue !== undefined ? 1 : 0);
    return rightScore - leftScore;
  });

  for (const reading of sorted) {
    const key = readingKey(reading);
    if (seen.has(key)) {
      continue;
    }

    const hasWeakerDuplicate = result.some(
      (existing) =>
        existing.currentValue === reading.currentValue &&
        existing.previousValue !== undefined &&
        reading.previousValue === undefined &&
        !reading.label &&
        !reading.meterNumber,
    );
    if (hasWeakerDuplicate) {
      continue;
    }

    const weakerIndex = result.findIndex(
      (existing) =>
        existing.currentValue === reading.currentValue &&
        existing.previousValue === undefined &&
        reading.previousValue !== undefined &&
        !existing.label &&
        !existing.meterNumber,
    );
    if (weakerIndex >= 0) {
      seen.delete(readingKey(result[weakerIndex]!));
      result.splice(weakerIndex, 1);
    }

    const hasLabeledDuplicate = result.some(
      (existing) =>
        existing.currentValue === reading.currentValue &&
        (existing.label || existing.meterNumber) &&
        !reading.label &&
        !reading.meterNumber,
    );
    if (hasLabeledDuplicate) {
      continue;
    }

    seen.add(key);
    result.push(reading);
  }

  return result;
}

function extractClientNumber(text: string): string | undefined {
  const normalized = normalizeForMatch(text);

  for (const pattern of CLIENT_NUMBER_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalized);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function extractColonStructuredData(text: string): {
  clientNumber?: string;
  readings: ParsedEmailReading[];
} {
  const readings: ParsedEmailReading[] = [];
  let clientNumber: string | undefined;

  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.trim();
    if (!line.includes(":")) {
      continue;
    }

    const match = line.match(/^(.+?)\s*:\s*(.+)$/);
    if (!match) {
      continue;
    }

    const rawLabel = match[1].trim();
    const rawValue = match[2].trim();
    const normalizedLabel = normalizeForMatch(rawLabel);

    const clientInLabel = normalizedLabel.match(
      /^klienta\s*(?:nr\.?|numurs)\s*:?\s*(\d{2,6})\s*$/,
    );
    if (clientInLabel?.[1]) {
      clientNumber = clientInLabel[1];
      continue;
    }

    if (/^klienta\s*(?:nr\.?|numurs)\s*$/.test(normalizedLabel)) {
      const numberMatch = rawValue.match(/(\d{2,6})/);
      if (numberMatch?.[1]) {
        clientNumber = numberMatch[1];
      }
      continue;
    }

    if (/^klienta\s*(?:nr|numurs)/.test(normalizedLabel)) {
      continue;
    }

    const rangeMatch = rawValue.match(
      new RegExp(`^${READING_CAPTURE}\\s*[-–]\\s*${READING_CAPTURE}$`),
    );
    if (rangeMatch) {
      const previousValue = parseNumericToken(rangeMatch[1]);
      const currentValue = parseNumericToken(rangeMatch[2]);
      if (currentValue !== null) {
        readings.push({
          label: canonicalReadingLabel(rawLabel),
          previousValue: previousValue ?? undefined,
          currentValue,
        });
      }
      continue;
    }

    const value = parseNumericToken(rawValue);
    if (value === null) {
      continue;
    }

    readings.push({
      label: canonicalReadingLabel(rawLabel),
      currentValue: value,
    });
  }

  return { clientNumber, readings };
}

function extractAddressHint(subject: string, body: string): string | undefined {
  const combined = `${subject}\n${body}`;

  const patterns = [
    /"([^"]{4,80})"/,
    /([A-Za-zĀ-ž][A-Za-zĀ-ž0-9\s.,\-/"']{3,60}(?:iela|ielas)\s*\d+[A-Za-z0-9\-/]*)/i,
    /([A-Za-zĀ-ž][A-Za-zĀ-ž0-9\-]{2,30}-\d+[A-Za-z0-9\-/]*,\s*[^,\n]{3,50})/,
    /([A-Za-zĀ-ž][A-Za-zĀ-ž0-9\s.,\-/"']{4,80}(?:pagasts|novads)[A-Za-zĀ-ž0-9\s.,\-/"']{0,40})/i,
    /([A-Za-zĀ-ž][A-Za-zĀ-ž0-9\s.,\-/"']{3,50}(?:iela|ielas)\s*\d+[^-\n]{0,30}),\s*([A-Za-zĀ-ž][A-Za-zĀ-ž\s-]{2,30})/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match?.[1]) {
      const hint = match[2] ? `${match[1].trim()}, ${match[2].trim()}` : match[1].trim();
      return hint.replace(/\s+/g, " ");
    }
  }

  return undefined;
}

function extractMeterTableReadings(text: string): ParsedEmailReading[] {
  const readings: ParsedEmailReading[] = [];
  const rowPattern =
    /(?:(maja\d+|virtuve|vanna|san\.?\s*bl\.?|saimniecibas[^\d]{0,30})\s+)?\b(8[A-Z]{2}\d{8,14})\b[^\d]{0,20}(\d+[.,]?\d*)[^\d]{0,20}(\d+[.,]?\d*)/gi;

  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(text)) !== null) {
    const location = match[1]?.trim();
    const previousValue = parseNumericToken(match[3]);
    const currentValue = parseNumericToken(match[4]);
    if (currentValue === null) {
      continue;
    }

    readings.push({
      meterNumber: match[2].toUpperCase(),
      label: location ? canonicalReadingLabel(location) : undefined,
      previousValue: previousValue ?? undefined,
      currentValue,
    });
  }

  return readings;
}

function extractM3LocationReadings(text: string): ParsedEmailReading[] {
  const readings: ParsedEmailReading[] = [];
  const normalized = normalizeForMatch(text);
  const pattern =
    /(aukstais|karstais|siltais)\s+udens\s+(virtuve|vanna|san\.?\s*bl\.?)\s+(\d{1,5}(?:[.,]\d+)?)\s*m3/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    const value = parseNumericToken(match[3]);
    if (value === null) {
      continue;
    }

    readings.push({
      label: `${canonicalReadingLabel(match[1])} ${match[2]}`,
      currentValue: value,
    });
  }

  return readings;
}

function extractSemicolonLabeledReadings(text: string): ParsedEmailReading[] {
  if (!text.includes(";")) {
    return [];
  }

  const readings: ParsedEmailReading[] = [];
  const segments = text.split(/[;]/);
  const numberPattern = new RegExp(
    `(aukst\\.?\\s*ud\\.?|karstais|siltais|kanalizacij\\w*)[^0-9]{0,20}[-–]?\\s*${READING_CAPTURE}`,
    "i",
  );

  for (const segment of segments) {
    const match = segment.match(numberPattern);
    if (!match) {
      continue;
    }

    const value = parseNumericToken(match[2]);
    if (value === null) {
      continue;
    }

    readings.push({
      label: canonicalReadingLabel(match[1]),
      currentValue: value,
    });
  }

  return readings;
}

function extractLabeledDashReadings(text: string): ParsedEmailReading[] {
  const readings: ParsedEmailReading[] = [];
  const normalized = normalizeForMatch(text);
  const pattern = new RegExp(
    `(aukstais|karstais|siltais|kanalizacij\\w*)[^0-9]{0,10}[-–]\\s*${READING_CAPTURE}`,
    "gi",
  );

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    const value = parseNumericToken(match[2]);
    if (value === null) {
      continue;
    }

    readings.push({
      label: canonicalReadingLabel(match[1]),
      currentValue: value,
    });
  }

  return readings;
}

function isLikelyMeterRange(raw: string, previousValue: number, currentValue: number): boolean {
  if (/[.,]/.test(raw)) {
    return true;
  }

  if (!Number.isInteger(previousValue) || !Number.isInteger(currentValue)) {
    return true;
  }

  if (previousValue >= 10 && currentValue >= 10) {
    return true;
  }

  return false;
}

function getLineAtMatchIndex(text: string, matchIndex: number, matchLength: number): string {
  const lineStart = text.lastIndexOf("\n", matchIndex - 1) + 1;
  const lineEnd = text.indexOf("\n", matchIndex + matchLength);
  return text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
}

function isClientEqualsSplitLine(line: string): boolean {
  if (/klienta\s*nr/i.test(line)) {
    return false;
  }

  return new RegExp(`^\\s*\\d{2,6}\\s*=\\s*${READING_NUMBER}\\s*[-–]\\s*${READING_NUMBER}\\s*$`).test(
    line.trim(),
  );
}

function extractClientEqualsSplitReadings(text: string): {
  clientNumber?: string;
  readings: ParsedEmailReading[];
} {
  const readings: ParsedEmailReading[] = [];
  let clientNumber: string | undefined;

  const pattern = new RegExp(
    `(?:^|\\n)\\s*(\\d{2,6})\\s*=\\s*${READING_CAPTURE}\\s*[-–]\\s*${READING_CAPTURE}`,
    "gi",
  );

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const line = getLineAtMatchIndex(text, match.index, match[0].length);
    if (!isClientEqualsSplitLine(line)) {
      continue;
    }

    const firstValue = parseNumericToken(match[2]);
    const secondValue = parseNumericToken(match[3]);
    if (firstValue === null || secondValue === null) {
      continue;
    }

    clientNumber = match[1];
    readings.push({ currentValue: firstValue });
    readings.push({ currentValue: secondValue });
  }

  return { clientNumber, readings };
}

function isInsideClientEqualsSplit(text: string, matchIndex: number, matchLength: number): boolean {
  return isClientEqualsSplitLine(getLineAtMatchIndex(text, matchIndex, matchLength));
}

function extractEqualsRangeReadings(text: string): ParsedEmailReading[] {
  const readings: ParsedEmailReading[] = [];
  const rangePattern = new RegExp(`=\\s*${READING_CAPTURE}\\s*[-–]\\s*${READING_CAPTURE}`, "g");

  let match: RegExpExecArray | null;
  while ((match = rangePattern.exec(text)) !== null) {
    if (isInsideClientEqualsSplit(text, match.index, match[0].length)) {
      continue;
    }

    const previousValue = parseNumericToken(match[1]);
    const currentValue = parseNumericToken(match[2]);
    if (currentValue !== null && previousValue !== null) {
      const raw = match[0];
      if (isLikelyMeterRange(raw, previousValue, currentValue)) {
        readings.push({
          previousValue,
          currentValue,
        });
      }
    }
  }

  return readings;
}

function extractInlineRangeReadings(text: string): ParsedEmailReading[] {
  const readings: ParsedEmailReading[] = [];
  const pattern = new RegExp(`${READING_CAPTURE}\\s*[-–]\\s*${READING_CAPTURE}`, "g");

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (isInsideClientEqualsSplit(text, match.index, match[0].length)) {
      continue;
    }

    const previousValue = parseNumericToken(match[1]);
    const currentValue = parseNumericToken(match[2]);
    if (currentValue === null || previousValue === null) {
      continue;
    }

    if (!isLikelyMeterRange(match[0], previousValue, currentValue)) {
      continue;
    }

    readings.push({
      previousValue,
      currentValue,
    });
  }

  return readings;
}

function extractRadijumsReading(text: string): ParsedEmailReading[] {
  const match = text.match(new RegExp(`radijum\\w*\\s*[-:]\\s*${READING_CAPTURE}`, "i"));
  if (!match?.[1]) {
    return [];
  }

  const value = parseNumericToken(match[1]);
  return value === null ? [] : [{ currentValue: value }];
}

function extractAddressDashReading(text: string): ParsedEmailReading[] {
  const match = text.match(
    new RegExp(
      `([A-Za-zĀ-ž][A-Za-zĀ-ž0-9\\s.,\\-/"']{4,70})\\s*[-–]\\s*${READING_CAPTURE}\\s*$`,
    ),
  );
  if (!match?.[2]) {
    return [];
  }

  const value = parseNumericToken(match[2]);
  return value === null ? [] : [{ currentValue: value }];
}

function resolveConfidence(
  clientNumber: string | undefined,
  readings: ParsedEmailReading[],
): ParsedMeterEmail["confidence"] {
  if (clientNumber && readings.some((item) => item.meterNumber)) {
    return "high";
  }

  if (clientNumber && readings.length > 0) {
    return "medium";
  }

  if (readings.length > 0) {
    return "low";
  }

  return "low";
}

function resolveParseStatus(
  readings: ParsedEmailReading[],
  clientNumber: string | undefined,
  addressHint: string | undefined,
): "parsed" | "partial" | "failed" {
  if (readings.length === 0) {
    return "failed";
  }

  if (clientNumber || addressHint) {
    return "parsed";
  }

  return "partial";
}

export function parseMeterEmail(subject: string, body: string): ParsedMeterEmail {
  const warnings: string[] = [];
  const subjectText = subject ?? "";
  const bodyText = body ?? "";
  const combined = `${subjectText}\n${bodyText}`.replace(/\r/g, "");

  const colonData = extractColonStructuredData(combined);
  const splitData = extractClientEqualsSplitReadings(combined);
  const clientNumber =
    colonData.clientNumber ?? splitData.clientNumber ?? extractClientNumber(combined);
  const addressHint = extractAddressHint(subjectText, bodyText);

  if (!clientNumber && !addressHint) {
    warnings.push("Nav atrasts klienta numurs vai adrese.");
  }

  const readings = dedupeReadings([
    ...splitData.readings,
    ...colonData.readings,
    ...extractMeterTableReadings(combined),
    ...extractM3LocationReadings(combined),
    ...extractSemicolonLabeledReadings(combined),
    ...extractLabeledDashReadings(combined),
    ...extractEqualsRangeReadings(combined),
    ...extractRadijumsReading(combined),
    ...extractAddressDashReading(combined),
    ...extractInlineRangeReadings(combined),
  ]);

  if (readings.length === 0) {
    warnings.push("Nav atrasts neviens rādījums.");
  }

  if (subjectText.trim() && !bodyText.trim()) {
    warnings.push("Teksts tikai e-pasta tēmā — pārbaudiet tēmu manuāli.");
  }

  return {
    clientNumber,
    addressHint,
    readings,
    warnings,
    confidence: resolveConfidence(clientNumber, readings),
    parseVersion: EMAIL_PARSE_VERSION,
  };
}

export function getParseStatusFromParsed(parsed: ParsedMeterEmail): "parsed" | "partial" | "failed" {
  return resolveParseStatus(parsed.readings, parsed.clientNumber, parsed.addressHint);
}

export function parseNumericTokenForTests(raw: string): number | null {
  return parseNumericToken(raw);
}
