
import crypto from "node:crypto";
import Invoice from "../models/Invoice.js";
import IntegrationLog from "../models/IntegrationLog.js";
import Customer from "../models/Customer.js";

const verifyWebhookSignature = (req) => {
  const signature = req.headers["x-signature"];
  const secret = process.env.BILLPORT_SECRET;

  if (!signature || !secret || !req.rawBody) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex");

  const receivedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(
    expectedSignature,
    "hex"
  );

  return (
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    )
  );
};

export const receiveBillPortWebhook = async (req, res) => {
  try {
    // 1. Verify signature before processing the event.
    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({
        message: "Invalid webhook signature",
      });
    }

    const {
      eventId,
      externalId,
      status,
      sequence,
      occurredAt,
    } = req.body;

    // 2. Validate the webhook payload.
    if (
      !eventId ||
      !externalId ||
      !status ||
      !Number.isInteger(sequence) ||
      sequence < 1 ||
      !occurredAt
    ) {
      return res.status(400).json({
        message: "Invalid webhook payload",
      });
    }

    const allowedStatuses = [
      "SENT",
      "VIEWED",
      "PAID",
      "FAILED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Unsupported invoice status",
      });
    }

    // 3. Find the invoice.
    const invoice = await Invoice.findOne({ externalId });

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    // 4. Prevent duplicate webhook events.
    const existingEvent = await IntegrationLog.findOne({
      eventId,
      direction: "inbound",
    });

    if (existingEvent) {
      return res.status(200).json({
        message: "Duplicate event ignored",
      });
    }

    // 5. Ignore old or out-of-order events.
    if (sequence <= invoice.lastSequence) {
      await IntegrationLog.create({
        invoiceId: invoice._id,
        direction: "inbound",
        eventType: `invoice.${status.toLowerCase()}`,
        eventId,
        requestPayload: req.body,
        outcome: "duplicate",
        errorMessage: "Stale or out-of-order event ignored",
      });

      return res.status(200).json({
        message: "Stale event ignored",
      });
    }

    // 6. Save event before applying the status.
    await IntegrationLog.create({
      invoiceId: invoice._id,
      direction: "inbound",
      eventType: `invoice.${status.toLowerCase()}`,
      eventId,
      requestPayload: req.body,
      outcome: "success",
      httpStatus: 200,
    });

    // 7. Update invoice status.
    const statusMap = {
      SENT: "sent",
      VIEWED: "viewed",
      PAID: "paid",
      FAILED: "failed",
    };

    const previousStatus = invoice.status;

    invoice.status = statusMap[status];
    invoice.lastSequence = sequence;

    await invoice.save();

    // 8. Reduce customer outstanding balance only once.
    if (
      status === "PAID" &&
      previousStatus !== "paid"
    ) {
      await Customer.updateOne(
        { _id: invoice.customerId },
        {
          $max: {
            outstandingBalance: 0,
          },
          $inc: {
            outstandingBalance: -invoice.amount,
          },
        }
      );
    }

    return res.status(200).json({
      message: "Webhook processed successfully",
      externalId,
      status: invoice.status,
      sequence,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    return res.status(500).json({
      message: "Webhook processing failed",
    });
  }
};
