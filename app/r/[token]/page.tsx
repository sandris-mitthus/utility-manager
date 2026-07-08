import { ClientDirectReadingPanel } from "@/app/components/client-direct-reading-panel";
import { PublicDataProvider } from "@/app/components/public-data-provider";
import { loadPublicContactSettings } from "@/app/lib/utility/repository";
import { isSupabaseAdminConfigured } from "@/app/lib/supabase/env";

type ClientReadingPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ClientReadingPage({ params }: ClientReadingPageProps) {
  const { token } = await params;

  if (!isSupabaseAdminConfigured()) {
    return (
      <main className="page">
        <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Sistēma nav konfigurēta. Pievienojiet Supabase vides mainīgos `.env.local` failā.
        </div>
      </main>
    );
  }

  const settings = await loadPublicContactSettings();

  return (
    <PublicDataProvider initialSettings={{ settings }}>
      <main className="page">
        <ClientDirectReadingPanel token={token} />
      </main>
    </PublicDataProvider>
  );
}
