import mongoose, { Schema, Document, Model } from "mongoose";
import type { UserRole } from "./User.js";

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId | null;
  actorName: string;
  actorRole: UserRole | "SYSTEM";
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, default: "Ticket" },
    entityId: { type: String, required: true, index: true },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

AuditLogSchema.index({ entityId: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
