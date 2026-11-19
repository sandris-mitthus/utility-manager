import { NextRequest } from "next/server";
import { requireAdminRead, requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import {
  listIntegrations,
  RESEND_INTEGRATION_KEY,
  resetResendIntegration,
  saveResendIntegration,
  setResendEnabled,
} from "@/app/lib/utility/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const items = await listIntegrations();
    return Response.json({ success: true, items });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ielādēt integrācijas.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminWrite(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      key?: string;
      reset?: boolean;
      enabled?: boolean;
      fromEmail?: string;
      apiKey?: string;
      keepSecret?: boolean;
      replyToEmail?: string;
    };

    if (body.key !== RESEND_INTEGRATION_KEY) {
      return Response.json({ success: false, message: "Nezināma integrācija." }, { status: 400 });
    }

    const item = body.reset
      ? await resetResendIntegration()
      : typeof body.enabled === "boolean" && body.fromEmail === undefined
        ? await setResendEnabled(body.enabled)
        : await saveResendIntegration({
            fromEmail: body.fromEmail ?? "",
            apiKey: body.apiKey ?? "",
            keepSecret: body.keepSecret === true,
            replyToEmail: body.replyToEmail ?? "",
          });

    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: body.reset ? "reset" : "update",
      entityType: "site_integration",
      entityId: RESEND_INTEGRATION_KEY,
    });

    return Response.json({ success: true, item });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās saglabāt integrāciju.",
      },
      { status: 400 },
    );
  }
}
