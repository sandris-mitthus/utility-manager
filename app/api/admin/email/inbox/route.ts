import { NextRequest } from "next/server";
import { requireAdminRead, requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { fetchContactInboxEmails } from "@/app/lib/utility/fetch-contact-inbox";
import {
  deleteEmailInboxMessage,
  listEmailInboxMessages,
  loadEmailFetchState,
  reparseAllEmailInboxMessages,
} from "@/app/lib/utility/email-inbox-repository";
import { runEmailInboxImportPipeline } from "@/app/lib/utility/import-email-inbox-submissions";
import { deleteIdQuerySchema } from "@/app/lib/utility/schemas";

const EMAIL_IMPORT_BATCH_SIZE = 10;

async function loadInboxResponseData() {
  const [messages, fetchState] = await Promise.all([
    listEmailInboxMessages(100),
    loadEmailFetchState(),
  ]);

  return { messages, fetchState };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { messages, fetchState } = await loadInboxResponseData();

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
      const messages = await listEmailInboxMessages(100);

      await writeAdminAuditLog({
        adminEmail: auth.admin.email,
        action: "reparse",
        entityType: "email_inbox",
        entityId: "inbox",
        details: { reparsedCount },
      });

      return Response.json({
        success: true,
        data: {
          reparsedCount,
          fetchState: await loadEmailFetchState(),
          messages,
        },
      });
    }

    if (action === "import") {
      const importSummary = await runEmailInboxImportPipeline(EMAIL_IMPORT_BATCH_SIZE);
      const messages = await listEmailInboxMessages(100);

      await writeAdminAuditLog({
        adminEmail: auth.admin.email,
        action: "import_batch",
        entityType: "email_inbox",
        entityId: "inbox",
        details: { importSummary, batchSize: EMAIL_IMPORT_BATCH_SIZE },
      });

      return Response.json({
        success: true,
        data: {
          importSummary,
          fetchState: await loadEmailFetchState(),
          messages,
        },
      });
    }

    const result = await fetchContactInboxEmails();
    const messages = await listEmailInboxMessages(100);

    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "fetch",
      entityType: "email_inbox",
      entityId: "inbox",
      details: result.summary,
    });

    return Response.json({
      success: true,
      data: {
        summary: result.summary,
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
