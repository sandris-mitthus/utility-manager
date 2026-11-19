import { NextRequest } from "next/server";
import { requireAdminRead, requireAdminWrite } from "@/app/lib/auth/require-admin-mutation";
import { writeAdminAuditLog } from "@/app/lib/security/audit-log";
import {
  loadVoiceAgentAccess,
  rotateVoiceAgentKey,
  setVoiceAgentEnabled,
} from "@/app/lib/utility/voice-agent";
import { VOICE_AGENT_PATH } from "@/app/lib/utility/voice-agent-tools";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRead(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const base = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
    return Response.json({
      success: true,
      access: await loadVoiceAgentAccess(),
      endpoint: `${base}${VOICE_AGENT_PATH}`,
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Neizdevās ielādēt API piekļuvi." },
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
    const body = (await request.json()) as { enabled?: boolean; rotate?: boolean };
    if (body.rotate !== true && typeof body.enabled !== "boolean") {
      return Response.json({ success: false, message: "Nav ko saglabāt." }, { status: 400 });
    }

    const access = body.rotate === true ? await rotateVoiceAgentKey() : await setVoiceAgentEnabled(body.enabled === true);

    await writeAdminAuditLog({
      adminEmail: auth.admin.email,
      action: body.rotate === true ? "rotate_key" : access.enabled ? "enable" : "disable",
      entityType: "site_integration",
      entityId: "voice_agent",
    });

    return Response.json({ success: true, access });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Neizdevās saglabāt API piekļuvi." },
      { status: 500 },
    );
  }
}
