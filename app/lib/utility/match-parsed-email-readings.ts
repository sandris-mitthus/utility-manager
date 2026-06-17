import { calculateConsumption, METER_TYPE_LABELS } from "@/app/lib/utility/helpers";
import type {
  MeterType,
  ParsedEmailReading,
  ParsedMeterEmail,
  UtilityClient,
  UtilityMeter,
} from "@/app/lib/utility/types";

export type EmailReadingMatchMethod =
  | "meter_number"
  | "label_type_location"
  | "label_type"
  | "previous_reading"
  | "value_increase"
  | "closest_baseline"
  | "none";

export type MatchedEmailReading = {
  source: ParsedEmailReading;
  meterId: string | null;
  meterNumber: string | null;
  meterType: MeterType | null;
  meterLocation: string | null;
  baselineReading: number | null;
  consumption: number | null;
  matchMethod: EmailReadingMatchMethod;
  isValidReading: boolean;
  notes: string[];
};

export type EnrichedParsedEmail = ParsedMeterEmail & {
  matchedClientId: string | null;
  matchedReadings: MatchedEmailReading[];
};

const READING_EPSILON = 0.15;

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMeterNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function inferMeterTypesFromLabel(label?: string): MeterType[] {
  if (!label) {
    return [];
  }

  const normalized = normalizeForMatch(label);
  if (/kanaliz/.test(normalized)) {
    return ["sewage"];
  }
  if (/aukst|saldt/.test(normalized)) {
    return ["cold_water"];
  }
  if (/karst|silt/.test(normalized)) {
    return ["hot_water"];
  }
  if (/laist|ievad/.test(normalized)) {
    return ["cold_water"];
  }

  return [];
}

function inferLocationHint(label?: string): string | null {
  if (!label) {
    return null;
  }

  const normalized = normalizeForMatch(label);
  if (/virtuv/.test(normalized)) {
    return "virtuve";
  }
  if (/vann/.test(normalized)) {
    return "vanna";
  }
  if (/san\.?\s*bl|sanmezg|sant/.test(normalized)) {
    return "san";
  }
  if (/darz/.test(normalized)) {
    return "darzs";
  }

  return null;
}

function locationMatches(meterLocation: string, hint: string): boolean {
  const meter = normalizeForMatch(meterLocation);
  const target = normalizeForMatch(hint);
  return meter.includes(target) || target.includes(meter);
}

function readingIsNotLowerThanBaseline(current: number, baseline: number): boolean {
  return current >= baseline - READING_EPSILON;
}

function scoreValueAgainstMeter(reading: ParsedEmailReading, meter: UtilityMeter): number {
  const baseline = meter.baselineReading;
  const current = reading.currentValue;
  let score = 0;
  const baselineDistance = Math.abs(current - baseline);
  const increase = current - baseline;

  if (reading.previousValue !== undefined) {
    const previousDiff = Math.abs(reading.previousValue - baseline);
    if (previousDiff <= 1) {
      score += 500;
    } else if (previousDiff <= 5) {
      score += 250;
    }
  }

  score += Math.max(0, 180 - baselineDistance);

  if (readingIsNotLowerThanBaseline(current, baseline)) {
    if (increase < READING_EPSILON) {
      // Jauns rādījums reti ir tieši vienāds ar iepriekšējo — nefavorizēt „0 patēriņš”.
      score += 50;
    } else {
      score += 400;
      score += Math.max(0, 100 - increase);
    }
  } else {
    score += Math.max(0, 80 - baselineDistance);
  }

  return score;
}

function buildMatchedReading(
  source: ParsedEmailReading,
  meter: UtilityMeter | null,
  matchMethod: EmailReadingMatchMethod,
  extraNotes: string[] = [],
): MatchedEmailReading {
  if (!meter) {
    return {
      source,
      meterId: null,
      meterNumber: null,
      meterType: null,
      meterLocation: null,
      baselineReading: null,
      consumption: null,
      matchMethod: "none",
      isValidReading: false,
      notes: ["Nav atrasts atbilstošs skaitītājs.", ...extraNotes],
    };
  }

  const baseline = meter.baselineReading;
  const isValid = readingIsNotLowerThanBaseline(source.currentValue, baseline);
  const consumption = calculateConsumption(baseline, source.currentValue);
  const notes = [...extraNotes];

  if (!isValid) {
    notes.push(
      `Rādījums ${source.currentValue} ir mazāks par iepriekšējo (${baseline}) — pārbaudiet.`,
    );
  } else if (consumption !== null && consumption === 0) {
    notes.push("Patēriņš ir 0 — iespējams, nav mainījies rādījums.");
  }

  return {
    source,
    meterId: meter.id,
    meterNumber: meter.number,
    meterType: meter.type,
    meterLocation: meter.location,
    baselineReading: baseline,
    consumption,
    matchMethod,
    isValidReading: isValid,
    notes,
  };
}

function findMeterByNumber(
  reading: ParsedEmailReading,
  meters: UtilityMeter[],
): UtilityMeter | null {
  if (!reading.meterNumber) {
    return null;
  }

  const target = normalizeMeterNumber(reading.meterNumber);
  return (
    meters.find((meter) => normalizeMeterNumber(meter.number) === target) ??
    meters.find((meter) => normalizeMeterNumber(meter.number).includes(target)) ??
    null
  );
}

function findMeterByLabel(
  reading: ParsedEmailReading,
  meters: UtilityMeter[],
): { meter: UtilityMeter | null; method: EmailReadingMatchMethod } {
  const types = inferMeterTypesFromLabel(reading.label);
  if (types.length === 0) {
    return { meter: null, method: "none" };
  }

  const typeCandidates = meters.filter((meter) => types.includes(meter.type));
  if (typeCandidates.length === 0) {
    return { meter: null, method: "none" };
  }

  const locationHint = inferLocationHint(reading.label);
  if (locationHint) {
    const located = typeCandidates.filter((meter) => locationMatches(meter.location, locationHint));
    if (located.length === 1) {
      return { meter: located[0], method: "label_type_location" };
    }
    if (located.length > 1) {
      const byValue = pickBestMeterByValue(reading, located);
      if (byValue) {
        return { meter: byValue, method: "label_type_location" };
      }
    }
  }

  if (typeCandidates.length === 1) {
    return { meter: typeCandidates[0], method: "label_type" };
  }

  const byValue = pickBestMeterByValue(reading, typeCandidates);
  if (byValue) {
    return { meter: byValue, method: "label_type" };
  }

  return { meter: null, method: "none" };
}

function pickBestMeterByValue(
  reading: ParsedEmailReading,
  meters: UtilityMeter[],
): UtilityMeter | null {
  let bestMeter: UtilityMeter | null = null;
  let bestScore = 0;

  for (const meter of meters) {
    const score = scoreValueAgainstMeter(reading, meter);
    if (score > bestScore) {
      bestScore = score;
      bestMeter = meter;
    }
  }

  if (!bestMeter || bestScore < 300) {
    return null;
  }

  return bestMeter;
}

function findMeterByValueIncrease(
  reading: ParsedEmailReading,
  meters: UtilityMeter[],
): { meter: UtilityMeter | null; method: EmailReadingMatchMethod } {
  const increasing = meters.filter((meter) =>
    readingIsNotLowerThanBaseline(reading.currentValue, meter.baselineReading),
  );

  if (reading.previousValue !== undefined) {
    const byPrevious = meters.filter(
      (meter) => Math.abs(meter.baselineReading - reading.previousValue!) <= 1,
    );
    if (byPrevious.length === 1) {
      return { meter: byPrevious[0], method: "previous_reading" };
    }
    if (byPrevious.length > 1) {
      const best = pickBestMeterByValue(reading, byPrevious);
      if (best) {
        return { meter: best, method: "previous_reading" };
      }
    }
  }

  if (increasing.length === 1) {
    return { meter: increasing[0], method: "value_increase" };
  }

  const best = pickBestMeterByValue(reading, increasing.length > 0 ? increasing : meters);
  if (!best) {
    return { meter: null, method: "none" };
  }

  return {
    meter: best,
    method: readingIsNotLowerThanBaseline(reading.currentValue, best.baselineReading)
      ? "value_increase"
      : "none",
  };
}

function isGenericReading(reading: ParsedEmailReading): boolean {
  return !reading.meterNumber && !reading.label && reading.previousValue === undefined;
}

function resolveValueMatchMethod(
  reading: ParsedEmailReading,
  meter: UtilityMeter,
): EmailReadingMatchMethod {
  if (readingIsNotLowerThanBaseline(reading.currentValue, meter.baselineReading)) {
    return "value_increase";
  }

  return "closest_baseline";
}

function matchGenericReadingsByOrderedBaseline(
  readings: ParsedEmailReading[],
  meters: UtilityMeter[],
  usedMeterIds: Set<string>,
): Map<ParsedEmailReading, MatchedEmailReading> | null {
  const available = meters.filter((meter) => !usedMeterIds.has(meter.id));
  if (readings.length === 0 || readings.length > available.length) {
    return null;
  }

  const sortedReadings = [...readings].sort(
    (left, right) => left.currentValue - right.currentValue,
  );
  const sortedMeters = [...available]
    .sort((left, right) => left.baselineReading - right.baselineReading)
    .slice(0, sortedReadings.length);

  const allValid = sortedReadings.every((reading, index) =>
    readingIsNotLowerThanBaseline(reading.currentValue, sortedMeters[index]!.baselineReading),
  );

  if (!allValid) {
    return null;
  }

  const results = new Map<ParsedEmailReading, MatchedEmailReading>();

  for (let index = 0; index < sortedReadings.length; index += 1) {
    const reading = sortedReadings[index]!;
    const meter = sortedMeters[index]!;
    results.set(reading, buildMatchedReading(reading, meter, "value_increase"));
    usedMeterIds.add(meter.id);
  }

  return results;
}

function matchGenericReadingsOptimally(
  readings: ParsedEmailReading[],
  meters: UtilityMeter[],
  usedMeterIds: Set<string>,
): Map<ParsedEmailReading, MatchedEmailReading> {
  const ordered = matchGenericReadingsByOrderedBaseline(readings, meters, usedMeterIds);
  if (ordered) {
    return ordered;
  }

  const results = new Map<ParsedEmailReading, MatchedEmailReading>();
  const remaining = [...readings];

  while (remaining.length > 0) {
    const available = meters.filter((meter) => !usedMeterIds.has(meter.id));
    if (available.length === 0) {
      for (const reading of remaining) {
        results.set(reading, buildMatchedReading(reading, null, "none", ["Nav brīvu skaitītāju."]));
      }
      break;
    }

    let bestScore = 0;
    let bestReading: ParsedEmailReading | null = null;
    let bestMeter: UtilityMeter | null = null;

    for (const reading of remaining) {
      for (const meter of available) {
        const score = scoreValueAgainstMeter(reading, meter);
        if (score > bestScore) {
          bestScore = score;
          bestReading = reading;
          bestMeter = meter;
        }
      }
    }

    if (!bestReading || !bestMeter || bestScore < 200) {
      for (const reading of remaining) {
        results.set(reading, buildMatchedReading(reading, null, "none"));
      }
      break;
    }

    remaining.splice(remaining.indexOf(bestReading), 1);
    usedMeterIds.add(bestMeter.id);
    results.set(
      bestReading,
      buildMatchedReading(bestReading, bestMeter, resolveValueMatchMethod(bestReading, bestMeter)),
    );
  }

  return results;
}

function matchSingleReading(
  reading: ParsedEmailReading,
  meters: UtilityMeter[],
  usedMeterIds: Set<string>,
): MatchedEmailReading {
  const available = meters.filter((meter) => !usedMeterIds.has(meter.id));

  const byNumber = findMeterByNumber(reading, available);
  if (byNumber) {
    return buildMatchedReading(reading, byNumber, "meter_number");
  }

  const byLabel = findMeterByLabel(reading, available);
  if (byLabel.meter) {
    return buildMatchedReading(reading, byLabel.meter, byLabel.method);
  }

  const byValue = findMeterByValueIncrease(reading, available);
  if (byValue.meter) {
    return buildMatchedReading(reading, byValue.meter, byValue.method);
  }

  return buildMatchedReading(reading, null, "none");
}

function sortReadingsForMatching(readings: ParsedEmailReading[]): ParsedEmailReading[] {
  return [...readings].sort((left, right) => {
    const leftScore =
      (left.meterNumber ? 100 : 0) +
      (left.label ? 50 : 0) +
      (left.previousValue !== undefined ? 25 : 0);
    const rightScore =
      (right.meterNumber ? 100 : 0) +
      (right.label ? 50 : 0) +
      (right.previousValue !== undefined ? 25 : 0);
    return rightScore - leftScore;
  });
}

export function matchParsedReadingsToClientMeters(
  parsed: ParsedMeterEmail,
  client: UtilityClient,
  meters: UtilityMeter[],
): MatchedEmailReading[] {
  const clientMeters = meters.filter((meter) => meter.clientId === client.id);
  const usedMeterIds = new Set<string>();
  const matchedByReading = new Map<ParsedEmailReading, MatchedEmailReading>();

  const specific: ParsedEmailReading[] = [];
  const generic: ParsedEmailReading[] = [];

  for (const reading of sortReadingsForMatching(parsed.readings)) {
    if (isGenericReading(reading)) {
      generic.push(reading);
    } else {
      specific.push(reading);
    }
  }

  for (const reading of specific) {
    const result = matchSingleReading(reading, clientMeters, usedMeterIds);
    matchedByReading.set(reading, result);
    if (result.meterId) {
      usedMeterIds.add(result.meterId);
    }
  }

  const genericMatches = matchGenericReadingsOptimally(generic, clientMeters, usedMeterIds);
  for (const [reading, result] of genericMatches) {
    matchedByReading.set(reading, result);
  }

  return parsed.readings.map((reading) => matchedByReading.get(reading) ?? buildMatchedReading(reading, null, "none"));
}

export function enrichParsedEmailWithClientMeters(
  parsed: ParsedMeterEmail,
  client: UtilityClient | null,
  meters: UtilityMeter[],
): EnrichedParsedEmail {
  if (!client) {
    return {
      ...parsed,
      matchedClientId: null,
      matchedReadings: parsed.readings.map((reading) =>
        buildMatchedReading(reading, null, "none", ["Klients nav atrasts DB."]),
      ),
    };
  }

  const matchedReadings = matchParsedReadingsToClientMeters(parsed, client, meters);
  const extraWarnings = [...parsed.warnings];

  const unmatchedCount = matchedReadings.filter((item) => !item.meterId).length;
  if (unmatchedCount > 0) {
    extraWarnings.push(`${unmatchedCount} rādījumam nav piesaistīts skaitītājs.`);
  }

  const invalidCount = matchedReadings.filter((item) => item.meterId && !item.isValidReading).length;
  if (invalidCount > 0) {
    extraWarnings.push(`${invalidCount} rādījums ir mazāks par iepriekšējo.`);
  }

  return {
    ...parsed,
    warnings: extraWarnings,
    matchedClientId: client.id,
    matchedReadings,
  };
}

export function formatMatchedReadingSummary(match: MatchedEmailReading): string {
  if (!match.meterId || !match.meterType) {
    return match.source.label ?? "Rādījums";
  }

  const typeLabel = METER_TYPE_LABELS[match.meterType];
  const location = match.meterLocation ? ` · ${match.meterLocation}` : "";
  return `${match.meterNumber} · ${typeLabel}${location}`;
}
