import { NextRequest } from "next/server";
import { requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import { whatsappTestMessageSchema } from "@/app/lib/utility/schemas";
import { loadWhatsappApiSettings, sendWhatsappMessage } from "@/app/lib/utility/whatsapp-notify";

export const runtime = "nodejs";

const TEST_MESSAGE_BODY =
  "Utility Manager: WhatsApp Business savienojuma tests. Ja saņēmāt šo ziņu, konfigurācija darbojas.";

export async function POST(request: NextRequest) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = whatsappTestMessageSchema.parse(await request.json().catch(() => ({})));
    const settings = await loadWhatsappApiSettings();
    const to = body.to?.trim() || settings.notifyNumber;

    if (!to) {
      return Response.json(
        {
          success: false,
          message: "Vispirms saglabājiet WhatsApp paziņojumu numuru.",
        },
        { status: 400 },
      );
    }

    const result = await sendWhatsappMessage(settings, { to, body: TEST_MESSAGE_BODY });

    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: result.ok ? "whatsapp_test_sent" : "whatsapp_test_failed",
      entityType: "contact_settings",
      entityId: "1",
    });

    if (!result.ok) {
      return Response.json({ success: false, message: result.message }, { status: 400 });
    }

    return Response.json({ success: true, message: `Testa ziņa nosūtīta uz ${to}.` });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās nosūtīt testa ziņu.",
      },
      { status: 400 },
    );
  }
}
