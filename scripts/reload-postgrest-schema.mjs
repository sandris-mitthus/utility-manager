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
    console.error(
      "Missing DATABASE_URL or SUPABASE_DB_PASSWORD in .env.local\n" +
        "Supabase Dashboard → Project Settings → Database → Database password",
    );
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

const env = loadEnv(".env.local");
const candidates = getConnectionCandidates(env);
let client;
let connectedVia = "";

for (const connectionString of candidates) {
  const attempt = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await attempt.connect();
    client = attempt;
    connectedVia = connectionString.replace(/:([^:@/]+)@/, ":***@");
    break;
  } catch (error) {
    console.log(`Connect skip: ${error.message}`);
    await attempt.end().catch(() => {});
  }
}

if (!client) {
  console.error("Could not connect to Supabase Postgres.");
  process.exit(1);
}

try {
  console.log("Connected to Supabase Postgres via", connectedVia);
  await client.query(`NOTIFY pgrst, 'reload schema'`);
  console.log("PostgREST schema cache reloaded.");
} catch (error) {
  console.error("Schema reload failed:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
