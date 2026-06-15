import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  const env = {};
  try {
    for (const line of readFileSync(join(process.cwd(), file), "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
  } catch {
    return env;
  }
  return env;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };

const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
const password = env.ADMIN_SEED_PASSWORD;

if (!url || !serviceKey || serviceKey.includes("YOUR_")) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!email || !password) {
  console.error(
    "Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD in .env.local\n" +
      "Add them locally only — never commit real passwords.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existingRow, error: lookupError } = await supabase
  .from("admin_users")
  .select("id, email, auth_user_id")
  .eq("email", email)
  .maybeSingle();

if (lookupError) {
  console.error("admin_users lookup failed:", lookupError.message);
  process.exit(1);
}

let adminRow = existingRow;

let authUserId = adminRow?.auth_user_id ?? null;

const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (listError) {
  console.error("Auth listUsers failed:", listError.message);
  process.exit(1);
}

if (!authUserId) {
  const existingAuthUser = listData.users.find(
    (user) => user.email?.trim().toLowerCase() === email,
  );

  if (existingAuthUser) {
    authUserId = existingAuthUser.id;
    console.log("Found auth user by email:", email);
  }
}

if (!authUserId && adminRow?.auth_user_id) {
  authUserId = adminRow.auth_user_id;
}

if (!authUserId) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    console.error("Auth createUser failed:", createError.message);
    process.exit(1);
  }

  authUserId = created.user.id;
  console.log("Created auth user:", email);
} else {
  const { error: updateAuthError } = await supabase.auth.admin.updateUserById(authUserId, {
    email,
    password,
    email_confirm: true,
  });

  if (updateAuthError) {
    console.error("Auth updateUser failed:", updateAuthError.message);
    process.exit(1);
  }

  console.log("Synced auth user email/password:", email);
}

if (adminRow) {
  const { error: updateError } = await supabase
    .from("admin_users")
    .update({ email, auth_user_id: authUserId })
    .eq("id", adminRow.id);

  if (updateError) {
    console.error("admin_users update failed:", updateError.message);
    process.exit(1);
  }

  console.log("Updated admin_users row for:", email);
} else {
  const { error: insertError } = await supabase.from("admin_users").insert({
    email,
    auth_user_id: authUserId,
  });

  if (insertError) {
    console.error("admin_users insert failed:", insertError.message);
    process.exit(1);
  }

  console.log("Inserted admin_users row for:", email);
}

console.log("Admin seed complete.");
