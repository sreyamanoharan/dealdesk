
import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
console.log(
  "BillPort secret loaded:",
  Boolean(process.env.BILLPORT_SECRET),
  "Length:",
  process.env.BILLPORT_SECRET?.length
);

const app = express();
const PORT = 5001;

// Capture the original request body for signature verification.
app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  })
);

// Temporary in-memory invoice storage.
const invoices = new Map();

// Store idempotency keys to prevent duplicate invoices.
const idempotencyKeys = new Map();

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "BillPort API is running",
  });
});

// Verify HMAC-SHA256 signature.
const verifySignature = (req, res, next) => {
  try {
    const signature = req.headers["x-signature"];
    const secret = process.env.BILLPORT_SECRET;

    if (!signature || !secret || !req.rawBody) {
      return res.status(401).json({
        message: "Missing signature or shared secret",
      });
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

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      return res.status(401).json({
        message: "Invalid request signature",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Signature verification failed",
    });
  }
};


const sendWebhook = async (invoice, status, sequence) => {
  const event = {
    eventId: crypto.randomUUID(),
    externalId: invoice.externalId,
    status,
    sequence,
    occurredAt: new Date().toISOString(),
  };

  const body = JSON.stringify(event);

  const signature = crypto
    .createHmac("sha256", process.env.BILLPORT_SECRET)
    .update(body)
    .digest("hex");

  try {
    const response = await fetch(
      process.env.DEALDESK_WEBHOOK_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(3000),
      }
    );

    console.log(
      `Webhook ${status}:`,
      response.status
    );
  } catch (error) {
    console.error("Webhook delivery failed:", error.message);
  }
};

// Create invoice
app.post(
  "/billing/invoices",
  verifySignature,
  async (req, res) => {
    try {
      const idempotencyKey =
        req.headers["idempotency-key"];

      if (!idempotencyKey) {
        return res.status(400).json({
          message: "Idempotency-Key header is required",
        });
      }

      // Return the existing invoice for repeated requests.
      if (idempotencyKeys.has(idempotencyKey)) {
        const existingId =
          idempotencyKeys.get(idempotencyKey);

        return res.status(201).json({
          externalId: existingId,
          status: "QUEUED",
          message: "Existing invoice returned",
        });
      }

      // Simulate 15% server failure.
      if (Math.random() < 0.15) {
        return res.status(503).json({
          message: "BillPort temporarily unavailable",
        });
      }

      // Simulate 10% slow response.
      if (Math.random() < 0.10) {
        await new Promise((resolve) =>
          setTimeout(resolve, 6000)
        );
      }

      const externalId = `BP-${crypto.randomUUID()}`;

      const invoice = {
        externalId,
        status: "QUEUED",
        updatedAt: new Date(),
        payload: req.body,
      };

      invoices.set(externalId, invoice);
      idempotencyKeys.set(idempotencyKey, externalId);

let sequence = 0;

const statuses = ["SENT", "VIEWED", "PAID"];

const scheduleNextStatus = () => {
  setTimeout(async () => {
    const currentInvoice = invoices.get(externalId);

    if (!currentInvoice) return;

    const status = statuses[sequence];

    currentInvoice.status = status;
    currentInvoice.updatedAt = new Date();

    invoices.set(externalId, currentInvoice);

    sequence++;

    await sendWebhook(
      currentInvoice,
      status,
      sequence
    );

    if (sequence < statuses.length) {
      scheduleNextStatus();
    }
  }, Math.floor(Math.random() * 25000) + 5000);
};

scheduleNextStatus();


      return res.status(201).json({
        externalId,
        status: "QUEUED",
      });
    } catch (error) {
      console.error("Invoice creation error:", error);

      return res.status(500).json({
        message: "Invoice creation failed",
      });
    }
  }
);

// Get invoice status
app.get("/billing/invoices/:externalId", (req, res) => {
  const invoice = invoices.get(req.params.externalId);

  if (!invoice) {
    return res.status(404).json({
      message: "Invoice not found",
    });
  }

  return res.status(200).json({
    externalId: invoice.externalId,
    status: invoice.status,
    updatedAt: invoice.updatedAt,
  });
});

// Start BillPort server
app.listen(PORT, () => {
  console.log(`BillPort running on port ${PORT}`);
});
