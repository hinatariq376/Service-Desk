import mongoose, { Schema, Document, Model } from "mongoose";
import type { TicketPriority } from "./Ticket.js";

export interface ISLAPolicy extends Document {
  _id: mongoose.Types.ObjectId;
  priority: TicketPriority;
  responseMinutes: number;
  resolutionHours: number;
}

const SLAPolicySchema = new Schema<ISLAPolicy>(
  {
    priority: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      required: true,
      unique: true,
    },
    responseMinutes: { type: Number, required: true },
    resolutionHours: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

export const SLAPolicy: Model<ISLAPolicy> =
  mongoose.models.SLAPolicy || mongoose.model<ISLAPolicy>("SLAPolicy", SLAPolicySchema);
