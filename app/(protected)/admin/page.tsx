import { AdminPanel } from "@/app/components/admin/admin-panel";
import { SectionPage } from "@/app/components/section-page";

export default function AdminPage() {
  return (
    <SectionPage
      title="Administrācija"
      subtitle="Demo panelis klientiem, skaitītājiem, rādījumiem un iestatījumiem"
    >
      <AdminPanel />
    </SectionPage>
  );
}
