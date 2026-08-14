import { supabase } from "../lib/supabase";
import type { Role } from "../types";

export interface AuditPayload {
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entityId: string;
  entityType: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export async function insertAuditLog(payload: AuditPayload) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: payload.actorId,
    actor_name: payload.actorName,
    actor_role: payload.actorRole,
    action: payload.action,
    entity_id: payload.entityId,
    entity_type: payload.entityType,
    old_value: payload.oldValue ?? null,
    new_value: payload.newValue ?? null,
  });

  if (error) {
    console.error("Audit log insert failed:", error.message);
  }
}
