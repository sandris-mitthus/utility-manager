import { ClientDirectReadingPanel } from "@/app/components/client-direct-reading-panel";
import { PublicDataProvider } from "@/app/components/public-data-provider";
import { PublicStatusNotice } from "@/app/components/public-status-notice";
import { loadPublicContactSettings } from "@/app/lib/utility/repository";
import { readableSupabaseError } from "@/app/lib/supabase/fetch";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";

type ClientReadingPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ClientReadingPage({ params }: ClientReadingPageProps) {
  const { token } = await params;

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
        <ClientDirectReadingPanel token={token} />
      </main>
    </PublicDataProvider>
  );
}
