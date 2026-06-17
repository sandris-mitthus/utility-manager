import { AdminPanel } from "@/app/components/admin/admin-panel";
import { getAdminAccess } from "@/app/lib/auth/get-admin-access";
import {
  listEmailInboxMessages,
  loadEmailFetchState,
  reparseOutdatedEmailInboxMessages,
} from "@/app/lib/utility/email-inbox-repository";
import { runEmailInboxImportPipeline } from "@/app/lib/utility/import-email-inbox-submissions";
import type { EmailFetchState, EmailInboxMessage } from "@/app/lib/utility/types";

async function loadInitialEmailInbox(): Promise<{
  messages: EmailInboxMessage[];
  fetchState: EmailFetchState;
} | null> {
  try {
    await reparseOutdatedEmailInboxMessages(20);
    await runEmailInboxImportPipeline(30);
    const [messages, fetchState] = await Promise.all([
      listEmailInboxMessages(100),
      loadEmailFetchState(),
    ]);
    return { messages, fetchState };
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const access = await getAdminAccess();

  if (access.status !== "authenticated") {
    return null;
  }

  const initialEmailInbox = await loadInitialEmailInbox();

  return <AdminPanel admin={access.admin} initialEmailInbox={initialEmailInbox} />;
}
