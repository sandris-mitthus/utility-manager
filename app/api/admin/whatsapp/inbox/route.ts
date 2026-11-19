import { NextRequest } from "next/server";
import { requireAdminRead, requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { runWhatsappInboxImportPipeline } from "@/app/lib/utility/import-whatsapp-inbox-submissions";
import { deleteIdQuerySchema } from "@/app/lib/utility/schemas";
import {
  deleteWhatsappInboxMessage,
  forceReparseAllWhatsappInboxMessages,
  listWhatsappInboxMessages,
} from "@/app/lib/utility/whatsapp-inbox-repository";
import { isWhatsappWebhookConfigured } from "@/app/lib/utility/whatsapp-webhook";

const WHATSAPP_IMPORT_BATCH_SIZE = 10;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const messages = await listWhatsappInboxMessages(100);

    return Response.json({
      success: true,
      data: {
        messages,
        webhookConfigured: isWhatsappWebhookConfigured(),
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ielādēt WhatsApp datus.",
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
      const reparsedCount = await forceReparseAllWhatsappInboxMessages();
      const messages = await listWhatsappInboxMessages(100);

      await writeAdminAuditLog({
        adminEmail: auth.admin.email,
        action: "reparse",
        entityType: "whatsapp_inbox",
        entityId: "inbox",
        details: { reparsedCount },
      });

      return Response.json({
        success: true,
        data: {
          reparsedCount,
          messages,
          webhookConfigured: isWhatsappWebhookConfigured(),
        },
      });
    }

    if (action === "import") {
      const importSummary = await runWhatsappInboxImportPipeline(WHATSAPP_IMPORT_BATCH_SIZE);
      const messages = await listWhatsappInboxMessages(100);

      await writeAdminAuditLog({
        adminEmail: auth.admin.email,
        action: "import_batch",
        entityType: "whatsapp_inbox",
        entityId: "inbox",
        details: { importSummary, batchSize: WHATSAPP_IMPORT_BATCH_SIZE },
      });

      return Response.json({
        success: true,
        data: {
          importSummary,
          messages,
          webhookConfigured: isWhatsappWebhookConfigured(),
        },
      });
    }

    return Response.json(
      { success: false, message: "Nezināma darbība. Izmantojiet action=import vai action=reparse." },
      { status: 400 },
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās apstrādāt WhatsApp inbox.",
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
      { success: false, message: "Trūkst derīga WhatsApp ieraksta id." },
      { status: 400 },
    );
  }

  try {
    await deleteWhatsappInboxMessage(parsed.data.id);
    const messages = await listWhatsappInboxMessages(100);

    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: "delete",
      entityType: "whatsapp_inbox",
      entityId: parsed.data.id,
    });

    return Response.json({
      success: true,
      data: {
        messages,
        webhookConfigured: isWhatsappWebhookConfigured(),
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās dzēst WhatsApp ierakstu.",
      },
      { status: 500 },
    );
  }
}
