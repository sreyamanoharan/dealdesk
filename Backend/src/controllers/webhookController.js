
import crypto from "node:crypto";
import mongoose from "mongoose";
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
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  return (
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  );
};

export const receiveBillPortWebhook = async (req, res) => {
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

  const allowedStatuses = ["SENT", "VIEWED", "PAID", "FAILED"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: "Unsupported invoice status",
    });
  }

  const statusMap = {
    SENT: "sent",
    VIEWED: "viewed",
    PAID: "paid",
    FAILED: "failed",
  };

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // Check whether this exact event was already processed.
      const existingEvent = await IntegrationLog.findOne({
        eventId,
        direction: "inbound",
      }).session(session);

      if (existingEvent) {
        result = {
          message: "Duplicate event ignored",
          duplicate: true,
        };
        return;
      }

      const invoice = await Invoice.findOne({
        externalId,
      }).session(session);

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Ignore older or out-of-order events.
      if (sequence <= invoice.lastSequence) {
        await IntegrationLog.create(
          [{
            invoiceId: invoice._id,
            direction: "inbound",
            eventType: `invoice.${status.toLowerCase()}`,
            eventId,
            requestPayload: req.body,
            outcome: "duplicate",
            errorMessage: "Stale or out-of-order event ignored",
            httpStatus: 200,
          }],
          { session }
        );

        result = {
          message: "Stale event ignored",
          duplicate: true,
        };
        return;
      }

      const previousStatus = invoice.status;

      // Update invoice status inside the transaction.
      invoice.status = statusMap[status];
      invoice.lastSequence = sequence;

      await invoice.save({ session });

      // Apply the balance reduction only on the first transition to PAID.
      if (status === "PAID" && previousStatus !== "paid") {
        const customerUpdate = await Customer.updateOne(
          { _id: invoice.customerId },
          {
            $inc: {
              outstandingBalance: -invoice.amount,
            },
          },
          { session }
        );

        if (customerUpdate.matchedCount !== 1) {
          throw new Error("Customer not found for invoice");
        }
      }

      // Log the event in the same transaction.
      await IntegrationLog.create(
        [{
          invoiceId: invoice._id,
          direction: "inbound",
          eventType: `invoice.${status.toLowerCase()}`,
          eventId,
          requestPayload: req.body,
          outcome: "success",
          httpStatus: 200,
        }],
        { session }
      );

      result = {
        message: "Webhook processed successfully",
        externalId,
        status: invoice.status,
        sequence,
      };
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error("Webhook processing error:", error);

    if (error.message === "Invoice not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Webhook processing failed",
    });

  } finally {
    await session.endSession();
  }
};
