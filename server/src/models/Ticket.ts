import mongoose, { Schema, Document, Model } from "mongoose";

export type TicketPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type TicketStatus =
  | "OPEN"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export interface ITicket extends Document {
  _id: mongoose.Types.ObjectId;
  displayId: string;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  assignedAgentId?: mongoose.Types.ObjectId | null;
  assignedAgentName?: string | null;
  slaResponseDeadline: Date;
  slaResolutionDeadline: Date;
  slaDeadline: Date;
  slaBreach: boolean;
  tags: string[];
  attachments: string[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    displayId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, default: "General", index: true },
    priority: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      default: "MEDIUM",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "OPEN",
        "TRIAGED",
        "ASSIGNED",
        "IN_PROGRESS",
        "WAITING_FOR_CUSTOMER",
        "RESOLVED",
        "CLOSED",
      ],
      default: "OPEN",
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerName: { type: String, required: true },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedAgentName: { type: String, default: null },
    slaResponseDeadline: { type: Date, required: true },
    slaResolutionDeadline: { type: Date, required: true },
    slaDeadline: { type: Date, required: true },
    slaBreach: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },
    attachments: { type: [String], default: [] },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for search, filtering, and role isolation
TicketSchema.index({ customerId: 1, deletedAt: 1, createdAt: -1 });
TicketSchema.index({ assignedAgentId: 1, deletedAt: 1, status: 1 });
TicketSchema.index({ status: 1, priority: 1, deletedAt: 1 });
TicketSchema.index({ createdAt: -1, deletedAt: 1 });
TicketSchema.index({ title: "text", description: "text", category: "text" });

export const Ticket: Model<ITicket> =
  mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", TicketSchema);
