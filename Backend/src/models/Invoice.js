
import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: true,
      unique: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    externalId: {
      type: String,
      default: null,
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: [
        "queued",
        "pending",
        "sent",
        "viewed",
        "paid",
        "failed",
        "retrying",
      ],
      default: "queued",
    },

    retryCount: {
      type: Number,
      default: 0,
    },

    maxRetries: {
      type: Number,
      default: 5,
    },

    nextRetryAt: {
      type: Date,
      default: Date.now,
    },

    lastAttemptAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },

    lastSequence: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;
