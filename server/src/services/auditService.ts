import mongoose from "mongoose";
import { AuditLog, type IAuditLog } from "../models/AuditLog.js";
import type { UserRole } from "../models/User.js";

export interface LogActionParams {
  actorId?: string | mongoose.Types.ObjectId | null;
  actorName: string;
  actorRole: UserRole | "SYSTEM";
  action: string;
  entity?: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(params: LogActionParams): Promise<IAuditLog> {
  const audit = new AuditLog({
    actorId: params.actorId ? new mongoose.Types.ObjectId(params.actorId.toString()) : null,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    entity: params.entity || "Ticket",
    entityId: params.entityId,
    oldValue: params.oldValue || null,
    newValue: params.newValue || null,
    timestamp: new Date(),
    metadata: params.metadata || {},
  });

  return audit.save();
}

export async function fetchAuditTrail(query: {
  search?: string;
  action?: string;
  entityId?: string;
  page?: number;
  limit?: number;
}): Promise<{ logs: IAuditLog[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(200, query.limit || 50);
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (query.action && query.action !== "ALL") {
    filter.action = query.action;
  }

  if (query.entityId) {
    filter.entityId = query.entityId;
  }

  if (query.search) {
    const s = query.search.trim();
    filter.$or = [
      { actorName: { $regex: s, $options: "i" } },
      { entityId: { $regex: s, $options: "i" } },
      { action: { $regex: s, $options: "i" } },
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, total, page, limit };
}
