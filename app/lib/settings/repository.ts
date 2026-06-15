import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from "@/app/lib/settings/types";

export async function getAppSettings(): Promise<AppSettings> {
  if (!isSupabaseAdminConfigured()) {
    return DEFAULT_APP_SETTINGS;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("app_name")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_APP_SETTINGS;
  }

  return {
    appName: data.app_name?.trim() || DEFAULT_APP_SETTINGS.appName,
    loadedFromDb: true,
  };
}
