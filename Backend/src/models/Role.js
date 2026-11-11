
import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    permissions: [
      {
        type: String,
        enum: [
          "deal.view",
          "deal.edit",
          "discount.approve",
          "invoice.issue",
          "invoice.cancel",
          "chat.send",
        ],
      },
    ],

    dataScope: {
      type: String,
      enum: ["own", "branch", "all"],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Role = mongoose.model("Role", roleSchema);

export default Role;
