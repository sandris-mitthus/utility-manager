import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

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

const env = loadEnv(".env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("ENV configured:", {
  url: Boolean(url && !url.includes("YOUR_")),
  anonKey: Boolean(anonKey && !anonKey.includes("YOUR_")),
  serviceKey: Boolean(serviceKey && !serviceKey.includes("YOUR_")),
});

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const anonClient = createClient(url, anonKey);
const { error: sessionError } = await anonClient.auth.getSession();
console.log(
  "AUTH (anon):",
  sessionError ? `ERROR — ${sessionError.message}` : "OK",
);

if (!serviceKey || serviceKey.includes("YOUR_")) {
  console.log("SERVICE ROLE: skip table probe (SUPABASE_SERVICE_ROLE_KEY not set)");
  process.exit(0);
}

const serviceClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const table of ["app_settings", "schema_migrations"]) {
  const { error } = await serviceClient.from(table).select("*", { count: "exact", head: true });
  console.log(`TABLE ${table}:`, error ? error.message : "OK — exists");
}

const { data, error: settingsError } = await serviceClient
  .from("app_settings")
  .select("app_name")
  .eq("id", 1)
  .maybeSingle();

if (settingsError) {
  console.log("APP_SETTINGS probe:", settingsError.message);
} else {
  console.log(`APP_SETTINGS probe: OK — app_name="${data?.app_name ?? "(missing)"}"`);
}
