import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const { Client } = pg;

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(join(process.cwd(), file), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function getProjectRef(url) {
  return url.replace("https://", "").replace(".supabase.co", "");
}

function getConnectionCandidates(env) {
  if (env.DATABASE_URL) return [env.DATABASE_URL];

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const password = env.SUPABASE_DB_PASSWORD;
  if (!url || !password) {
    console.error("Missing DATABASE_URL or SUPABASE_DB_PASSWORD in .env.local");
    process.exit(1);
  }

  const projectRef = getProjectRef(url);
  const encodedPassword = encodeURIComponent(password);
  const region = env.SUPABASE_DB_REGION || "eu-west-1";
  const poolerHost = `aws-0-${region}.pooler.supabase.com`;
  const poolerUser = `postgres.${projectRef}`;

  return [
    `postgresql://${poolerUser}:${encodedPassword}@${poolerHost}:5432/postgres`,
    `postgresql://${poolerUser}:${encodedPassword}@${poolerHost}:6543/postgres`,
    `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`,
  ];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
  }

  return rows;
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function toIsoDate(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function roundReading(value) {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 1000) / 1000;
}

function mapMeterType(typeCode) {
  const normalized = typeCode.trim().toUpperCase();
  if (normalized.startsWith("KU")) return "hot_water";
  if (normalized.startsWith("KAN")) return "sewage";
  if (normalized.startsWith("APK")) return "heating";
  if (normalized.startsWith("AU")) return "cold_water";
  return "cold_water";
}

function registryKey(code, number, typeCode, address) {
  const raw = [
    code.trim(),
    number.trim(),
    typeCode.trim().toUpperCase(),
    address.trim().replace(/\s+/g, " "),
  ].join("\n");
  return createHash("sha256").update(raw).digest("hex");
}

function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function connect() {
  const env = loadEnv(".env.local");
  let lastError = null;
  for (const connectionString of getConnectionCandidates(env)) {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
    }
  }
  throw lastError ?? new Error("Could not connect to the database");
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/import-client-registry.mjs <csv-path>");
  process.exit(1);
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const header = rows[0]?.map((value) => value.trim()) ?? [];
if (!header[0]?.includes("Klienta kods")) {
  console.error("Unexpected CSV header", header);
  process.exit(1);
}

const parsed = [];
const unknownTypes = new Map();
let roundedFromFour = 0;
let invalidDates = 0;

for (const columns of rows.slice(1)) {
  if (columns.length < 14) {
    console.error("Short row", columns);
    continue;
  }

  const [
    code,
    name,
    address,
    typeCode,
    number,
    validUntil,
    reading,
    email,
    phone,
    phoneExtra,
    extraCode,
    registeredOn,
    periodEnd,
    recordNumber,
  ] = columns;

  const normalizedType = typeCode.trim().toUpperCase();
  if (normalizedType && !/^(AU|KU|KAN|APK)/.test(normalizedType)) {
    unknownTypes.set(typeCode.trim(), (unknownTypes.get(typeCode.trim()) ?? 0) + 1);
  }

  const decimalLength = reading.trim().replace(",", ".").split(".")[1]?.length ?? 0;
  if (decimalLength > 3) roundedFromFour += 1;
  if (validUntil.trim() && !toIsoDate(validUntil)) invalidDates += 1;

  parsed.push({
    code: code.trim(),
    name: name.trim(),
    address: address.trim(),
    typeCode: typeCode.trim(),
    number: number.trim(),
    validUntil: toIsoDate(validUntil),
    reading: roundReading(reading),
    email: email.trim(),
    phone: phone.trim(),
    phoneExtra: phoneExtra.trim(),
    extraCode: extraCode.trim(),
    registeredOn: toIsoDate(registeredOn),
    periodEnd: toIsoDate(periodEnd),
    recordNumber: recordNumber.trim(),
  });
}

const clientsByCode = new Map();
for (const row of parsed) {
  const current = clientsByCode.get(row.code) ?? {
    names: [],
    addresses: [],
    emails: [],
    phones: [],
    phoneExtras: [],
    extraCodes: [],
  };
  current.names.push(row.name);
  current.addresses.push(row.address);
  current.emails.push(row.email);
  current.phones.push(row.phone);
  current.phoneExtras.push(row.phoneExtra);
  current.extraCodes.push(row.extraCode);
  clientsByCode.set(row.code, current);
}

const clients = [...clientsByCode.entries()].map(([code, value]) => ({
  code,
  name: mostCommon(value.names),
  address: mostCommon(value.addresses),
  email: mostCommon(value.emails),
  phone: mostCommon(value.phones),
  phoneExtra: mostCommon(value.phoneExtras),
  extraCode: mostCommon(value.extraCodes),
}));

const metersByKey = new Map();
for (const row of parsed) {
  const key = registryKey(row.code, row.number, row.typeCode, row.address);
  metersByKey.set(key, row);
}

console.log(
  JSON.stringify(
    {
      rows: parsed.length,
      clients: clients.length,
      meters: metersByKey.size,
      collapsedDuplicateMeters: parsed.length - metersByKey.size,
      roundedFromFour,
      invalidDates,
      unknownTypes: [...unknownTypes.entries()],
    },
    null,
    2,
  ),
);

const db = await connect();

try {
  await db.query("begin");

  const clientIdByCode = new Map();
  for (const batch of chunk(clients, 400)) {
    const result = await db.query(
      `
        insert into public.clients (
          client_number, name, address, email, phone, phone_extra, extra_code
        )
        select *
        from unnest(
          $1::text[],
          $2::text[],
          $3::text[],
          $4::text[],
          $5::text[],
          $6::text[],
          $7::text[]
        )
        on conflict (client_number) do update set
          name = excluded.name,
          address = excluded.address,
          email = excluded.email,
          phone = excluded.phone,
          phone_extra = excluded.phone_extra,
          extra_code = excluded.extra_code
        returning id, client_number
      `,
      [
        batch.map((client) => client.code),
        batch.map((client) => client.name),
        batch.map((client) => client.address),
        batch.map((client) => client.email),
        batch.map((client) => client.phone),
        batch.map((client) => client.phoneExtra),
        batch.map((client) => client.extraCode),
      ],
    );

    for (const row of result.rows) {
      clientIdByCode.set(row.client_number, row.id);
    }
  }

  const meters = [...metersByKey.entries()].map(([key, row]) => ({
    ...row,
    key,
    clientId: clientIdByCode.get(row.code),
    type: mapMeterType(row.typeCode),
  }));

  const missingClient = meters.find((meter) => !meter.clientId);
  if (missingClient) {
    throw new Error(`Missing client id for ${missingClient.code}`);
  }

  let upsertedMeters = 0;
  for (const batch of chunk(meters, 300)) {
    const result = await db.query(
      `
        insert into public.meters (
          number,
          type,
          type_code,
          verification_date,
          valid_until,
          client_id,
          location,
          address,
          previous_reading,
          baseline_reading,
          reading_registered_on,
          reading_period_end,
          reading_record_number,
          registry_key
        )
        select
          number,
          type,
          type_code,
          nullif(verification_date, '')::date,
          nullif(valid_until, '')::date,
          client_id::uuid,
          '',
          address,
          previous_reading,
          baseline_reading,
          nullif(reading_registered_on, '')::date,
          nullif(reading_period_end, '')::date,
          reading_record_number,
          registry_key
        from unnest(
          $1::text[],
          $2::text[],
          $3::text[],
          $4::text[],
          $5::text[],
          $6::text[],
          $7::text[],
          $8::numeric[],
          $9::numeric[],
          $10::text[],
          $11::text[],
          $12::text[],
          $13::text[]
        ) as row(
          number,
          type,
          type_code,
          verification_date,
          valid_until,
          client_id,
          address,
          previous_reading,
          baseline_reading,
          reading_registered_on,
          reading_period_end,
          reading_record_number,
          registry_key
        )
        on conflict (registry_key) do update set
          number = excluded.number,
          type = excluded.type,
          type_code = excluded.type_code,
          verification_date = excluded.verification_date,
          valid_until = excluded.valid_until,
          client_id = excluded.client_id,
          address = excluded.address,
          previous_reading = excluded.previous_reading,
          baseline_reading = excluded.baseline_reading,
          reading_registered_on = excluded.reading_registered_on,
          reading_period_end = excluded.reading_period_end,
          reading_record_number = excluded.reading_record_number
      `,
      [
        batch.map((meter) => meter.number),
        batch.map((meter) => meter.type),
        batch.map((meter) => meter.typeCode),
        batch.map((meter) => meter.validUntil ?? ""),
        batch.map((meter) => meter.validUntil ?? ""),
        batch.map((meter) => meter.clientId),
        batch.map((meter) => meter.address),
        batch.map((meter) => meter.reading),
        batch.map((meter) => meter.reading),
        batch.map((meter) => meter.registeredOn ?? ""),
        batch.map((meter) => meter.periodEnd ?? ""),
        batch.map((meter) => meter.recordNumber),
        batch.map((meter) => meter.key),
      ],
    );
    upsertedMeters += result.rowCount ?? 0;
  }

  await db.query("commit");
  console.log(`Imported ${clients.length} clients and ${upsertedMeters} meters.`);
} catch (error) {
  await db.query("rollback");
  throw error;
} finally {
  await db.end();
}
