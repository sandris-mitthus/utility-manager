import { createAdminClient } from "@/app/lib/supabase/admin";

type AuditLogInput = {
  adminEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function writeAdminAuditLog(entry: AuditLogInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("admin_audit_log").insert({
      admin_email: entry.adminEmail,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? {},
    });

    if (error) {
      console.error("admin_audit_log insert failed:", error.message);
    }
  } catch (error) {
    console.error("admin_audit_log write failed:", error);
  }
}
