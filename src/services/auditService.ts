import { supabase } from "../lib/supabase";
import type { Json } from "../lib/database.types";
import type { AuditLog, Role } from "../types";
import { mapAuditLog } from "../lib/mappers";

export interface AuditPayload {
  actorId?: string | null;
  actorName: string;
  actorRole: Role;
  action: string;
  entityId?: string | null;
  entityType: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

function isValidUUID(str?: string | null): boolean {
  return Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
}

export async function insertAuditLog(payload: AuditPayload) {
  // Pass entity_id as a valid UUID string or null, never an empty string ""
  const sanitizedEntityId = isValidUUID(payload.entityId) ? payload.entityId : null;
  const sanitizedActorId = isValidUUID(payload.actorId) ? payload.actorId : null;

  const insertData = {
    actor_id: sanitizedActorId,
    actor_name: payload.actorName,
    actor_role: payload.actorRole,
    action: payload.action,
    entity_id: sanitizedEntityId,
    entity_type: payload.entityType,
    old_value: (payload.oldValue as Json) ?? null,
    new_value: (payload.newValue as Json) ?? null,
  };

  // 1. Try inserting into public.activity_logs first
  let { data, error } = await supabase.from("activity_logs").insert(insertData).select();

  // 2. Fallback to audit_logs if activity_logs is not present
  if (error) {
    const fallbackRes = await supabase.from("audit_logs").insert(insertData).select();
    if (!fallbackRes.error) {
      data = fallbackRes.data;
      error = null;
    }
  }

  if (error) {
    console.error("Audit log insert failed:", error.message, error);
    console.error("Failed payload:", payload);
  } else {
    console.log("Audit log inserted successfully:", payload.action, sanitizedEntityId);
  }
  
  return { data, error };
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    // 1. Query public.activity_logs table
    const { data: activityData, error: activityError } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!activityError && activityData && activityData.length > 0) {
      return activityData.map(mapAuditLog);
    }

    // 2. Fallback to audit_logs table if activity_logs returned no rows or errored
    const { data: auditData, error: auditError } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!auditError && auditData && auditData.length > 0) {
      return auditData.map(mapAuditLog);
    }
  } catch (err) {
    console.warn("fetchAuditLogs exception:", err);
  }
  return [];
}

export const getAuditLogs = fetchAuditLogs;
