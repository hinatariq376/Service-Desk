import mongoose, { Schema, Document, Model } from "mongoose";
import type { UserRole } from "./User.js";

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  ticketId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorRole: UserRole;
  content: string;
  isInternal: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    authorRole: {
      type: String,
      enum: ["CUSTOMER", "SUPPORT_AGENT", "ADMIN"],
      required: true,
    },
    content: { type: String, required: true, trim: true },
    isInternal: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  }
);

CommentSchema.index({ ticketId: 1, deletedAt: 1, createdAt: 1 });

export const Comment: Model<IComment> =
  mongoose.models.Comment || mongoose.model<IComment>("Comment", CommentSchema);
