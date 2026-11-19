import { ContractLookupPanel } from "@/app/components/contract-lookup-panel";
import { PublicDataProvider } from "@/app/components/public-data-provider";
import { PublicStatusNotice } from "@/app/components/public-status-notice";
import { loadPublicContactSettings } from "@/app/lib/utility/repository";
import { readableSupabaseError } from "@/app/lib/supabase/fetch";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";

export default async function HomePage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <PublicStatusNotice message="Sistēma nav konfigurēta. Pievienojiet Supabase vides mainīgos `.env.local` failā." />
    );
  }

  let settings: Awaited<ReturnType<typeof loadPublicContactSettings>>;

  try {
    settings = await loadPublicContactSettings();
  } catch (error) {
    return (
      <PublicStatusNotice
        message={readableSupabaseError(error instanceof Error ? error.message : undefined)}
      />
    );
  }

  return (
    <PublicDataProvider initialSettings={{ settings }}>
      <main className="page">
        <ContractLookupPanel />
      </main>
    </PublicDataProvider>
  );
}
