
import axios from "axios";
import crypto from "node:crypto";
import Invoice from "../models/Invoice.js";
import IntegrationLog from "../models/IntegrationLog.js";

const BILLPORT_URL =
  process.env.BILLPORT_URL || "http://localhost:5001";

const MAX_BACKOFF_SECONDS = 60;
let workerRunning = false;

const processInvoice = async (invoice) => {
  const payload = {
    invoiceId: String(invoice._id),
    dealId: String(invoice.dealId),
    customerId: String(invoice.customerId),
    amount: invoice.amount,
  };

  // Sign exactly the bytes we send.
  const requestBody = JSON.stringify(payload);

  const signature = crypto
    .createHmac("sha256", process.env.BILLPORT_SECRET)
    .update(requestBody)
    .digest("hex");

  try {
    const response = await axios.post(
      `${BILLPORT_URL}/billing/invoices`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": invoice.idempotencyKey,
          "X-Signature": signature,
        },
        timeout: 3000,
      }
    );

    await IntegrationLog.create({
      invoiceId: invoice._id,
      direction: "outbound",
      eventType: "invoice.create",
      requestPayload: payload,
      responsePayload: response.data,
      httpStatus: response.status,
      outcome: "success",
    });
const externalId = response.data.externalId;

if (!externalId) {
  throw new Error("BillPort did not return an externalId");
}

const updateResult = await Invoice.updateOne(
  { _id: invoice._id },
  {
    $set: {
      externalId,
      status: "pending",
      lastAttemptAt: new Date(),
      lastError: null,
    },
  }
);

console.log("Invoice database update:", updateResult);

    console.log(
      `Invoice ${invoice._id} sent to BillPort: ${response.data.externalId}`
    );
  } catch (error) {
    const retryCount = invoice.retryCount + 1;

    const delaySeconds = Math.min(
      2 ** retryCount,
      MAX_BACKOFF_SECONDS
    );

    const failedPermanently =
      retryCount >= invoice.maxRetries;

    await IntegrationLog.create({
      invoiceId: invoice._id,
      direction: "outbound",
      eventType: "invoice.create",
      requestPayload: payload,
      responsePayload: error.response?.data || null,
      httpStatus: error.response?.status || null,
      outcome: "failed",
      errorMessage: error.message,
    });

    await Invoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          status: failedPermanently ? "failed" : "retrying",
          retryCount,
          lastAttemptAt: new Date(),
          lastError: error.message,
          nextRetryAt: new Date(
            Date.now() + delaySeconds * 1000
          ),
        },
      }
    );

    console.error(
      `Invoice ${invoice._id} attempt ${retryCount} failed: ${error.message}`
    );
  }
};

export const startInvoiceWorker = () => {
      console.log(
    "DealDesk secret loaded:",
    Boolean(process.env.BILLPORT_SECRET),
    "Length:",
    process.env.BILLPORT_SECRET?.length
  );
  if (!process.env.BILLPORT_SECRET) {
    throw new Error("BILLPORT_SECRET is missing");
  }

  console.log("Invoice worker started");

  setInterval(async () => {
    if (workerRunning) return;

    workerRunning = true;

    try {
      const invoices = await Invoice.find({
        status: { $in: ["queued", "retrying"] },
        nextRetryAt: { $lte: new Date() },
      }).limit(10);

      for (const invoice of invoices) {
        await processInvoice(invoice);
      }
    } catch (error) {
      console.error("Invoice worker error:", error);
    } finally {
      workerRunning = false;
    }
  }, 5000);
};
