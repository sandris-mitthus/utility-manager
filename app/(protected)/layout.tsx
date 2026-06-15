import { DemoDataProvider } from "@/app/components/demo-data-provider";
import { LoginGate } from "@/app/components/login-gate";
import { getCurrentUser } from "@/app/lib/auth/get-current-user";
import { isSupabaseConfigured } from "@/app/lib/supabase/env";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) {
      return <LoginGate />;
    }
  }

  return <DemoDataProvider>{children}</DemoDataProvider>;
}
