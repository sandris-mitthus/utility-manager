import { AdminLoginGate } from "@/app/components/admin/admin-login-gate";
import { AdminDataProvider } from "@/app/components/admin-data-provider";
import { getAdminAccess } from "@/app/lib/auth/get-admin-access";
import { createAdminCsrfToken } from "@/app/lib/security/admin-csrf";
import { isSupabaseConfigured } from "@/app/lib/supabase/env";
import { loadUtilityAdminState } from "@/app/lib/utility/repository";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isSupabaseConfigured()) {
    return <AdminLoginGate supabaseMissing />;
  }

  const access = await getAdminAccess();

  if (access.status === "unauthenticated") {
    return <AdminLoginGate />;
  }

  if (access.status === "forbidden") {
    return <AdminLoginGate forbiddenEmail={access.email} />;
  }

  const initialState = await loadUtilityAdminState();
  const csrfToken = createAdminCsrfToken(access.admin);

  return (
    <AdminDataProvider admin={access.admin} initialState={initialState} csrfToken={csrfToken}>
      <main className="page">{children}</main>
    </AdminDataProvider>
  );
}