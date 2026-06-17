import { NextRequest } from "next/server";
import { requireAdminRead, requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { fetchContactInboxEmails } from "@/app/lib/utility/fetch-contact-inbox";
import {
  deleteEmailInboxMessage,
  listEmailInboxMessages,
  loadEmailFetchState,
  reparseAllEmailInboxMessages,
  reparseOutdatedEmailInboxMessages,
} from "@/app/lib/utility/email-inbox-repository";
import { runEmailInboxImportPipeline } from "@/app/lib/utility/import-email-inbox-submissions";
import { deleteIdQuerySchema } from "@/app/lib/utility/schemas";

async function loadInboxResponseData() {
  await reparseOutdatedEmailInboxMessages(20);
  const importSummary = await runEmailInboxImportPipeline(30);
  const [messages, fetchState] = await Promise.all([
    listEmailInboxMessages(100),
    loadEmailFetchState(),
  ]);

  return { messages, fetchState, importSummary };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { messages, fetchState, importSummary } = await loadInboxResponseData();

    return Response.json({
      success: true,
      data: {
        messages,
        fetchState,
        importSummary,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ielādēt e-pasta datus.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  const action = request.nextUrl.searchParams.get("action");

  try {
    if (action === "reparse") {
      const reparsedCount = await reparseAllEmailInboxMessages();
      const importSummary = await runEmailInboxImportPipeline(50);
      const messages = await listEmailInboxMessages(100);

      await writeAdminAuditLog({
        adminEmail: auth.admin.email,
        action: "reparse",
        entityType: "email_inbox",
        entityId: "inbox",
        details: { reparsedCount, importSummary },
      });

      return Response.json({
        success: true,
        data: {
          reparsedCount,
          importSummary,
          fetchState: await loadEmailFetchState(),
          messages,
        },
      });
    }

    const result = await fetchContactInboxEmails();
    const importSummary = await runEmailInboxImportPipeline(50);
    const messages = await listEmailInboxMessages(100);

    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "fetch",
      entityType: "email_inbox",
      entityId: "inbox",
      details: { ...result.summary, importSummary },
    });

    return Response.json({
      success: true,
      data: {
        summary: result.summary,
        importSummary,
        fetchState: await loadEmailFetchState(),
        messages,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ievākt e-pastus.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = deleteIdQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });

  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Trūkst derīga e-pasta ieraksta id." },
      { status: 400 },
    );
  }

  try {
    await deleteEmailInboxMessage(parsed.data.id);
    const [messages, fetchState] = await Promise.all([
      listEmailInboxMessages(100),
      loadEmailFetchState(),
    ]);

    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "delete",
      entityType: "email_inbox",
      entityId: parsed.data.id,
    });

    return Response.json({
      success: true,
      data: {
        messages,
        fetchState,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās dzēst e-pasta ierakstu.",
      },
      { status: 500 },
    );
  }
}
