
import mongoose from "mongoose";
console.log("ApprovalConfig seed file started");
const approvalStepSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const discountBandSchema = new mongoose.Schema(
  {
    minDiscount: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      required: true,
      max: 100,
    },
    autoApprove: {
      type: Boolean,
      default: false,
    },
    steps: {
      type: [approvalStepSchema],
      default: [],
    },
  },
  { _id: false }
);

const approvalConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      default: "discount_approval",
    },
    bands: {
      type: [discountBandSchema],
      required: true,
    },
  },
  { timestamps: true }
);

const ApprovalConfig = mongoose.model(
  "ApprovalConfig",
  approvalConfigSchema
);

export default ApprovalConfig;
