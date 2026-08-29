import { supabase } from "../lib/supabase";
import type { Json } from "../lib/database.types";
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
  const { data, error } = await supabase.from("audit_logs").insert({
    actor_id: payload.actorId,
    actor_name: payload.actorName,
    actor_role: payload.actorRole,
    action: payload.action,
    entity_id: payload.entityId,
    entity_type: payload.entityType,
    old_value: (payload.oldValue as Json) ?? null,
    new_value: (payload.newValue as Json) ?? null,
  }).select();

  if (error) {
    console.error("Audit log insert failed:", error.message, error);
    console.error("Failed payload:", payload);
  } else {
    console.log("Audit log inserted successfully:", payload.action, payload.entityId);
  }
  
  return { data, error };
}
