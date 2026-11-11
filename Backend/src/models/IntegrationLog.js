
import mongoose from "mongoose";

const integrationLogSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },

    direction: {
      type: String,
      enum: ["outbound", "inbound"],
      required: true,
    },

    eventType: {
      type: String,
      required: true,
    },

    eventId: {
      type: String,
      default: null,
    },

    requestPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    httpStatus: {
      type: Number,
      default: null,
    },

    outcome: {
      type: String,
      enum: ["success", "failed", "rejected", "duplicate"],
      required: true,
    },

    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent processing the same webhook event more than once.
integrationLogSchema.index(
  { eventId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      eventId: { $type: "string" },
      direction: "inbound",
    },
  }
);

const IntegrationLog = mongoose.model(
  "IntegrationLog",
  integrationLogSchema
);

export default IntegrationLog;
