
import mongoose from "mongoose";

const approvalHistorySchema = new mongoose.Schema(
  {
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
    },
    stepOrder: {
      type: Number,
      required: true,
    },
    approverRoleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    approverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["approved", "rejected"],
      required: true,
    },
    comment: {
      type: String,
      default: "",
      trim: true,
    },
    actedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const ApprovalHistory = mongoose.model(
  "ApprovalHistory",
  approvalHistorySchema
);

export default ApprovalHistory;
