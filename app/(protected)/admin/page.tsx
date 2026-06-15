import { AdminPanel } from "@/app/components/admin/admin-panel";
import { getAdminAccess } from "@/app/lib/auth/get-admin-access";

export default async function AdminPage() {
  const access = await getAdminAccess();

  if (access.status !== "authenticated") {
    return null;
  }

  return <AdminPanel admin={access.admin} />;
}
