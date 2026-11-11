import crypto from "node:crypto";
import Invoice from "../models/Invoice.js";
import Deal from "../models/Deal.js";
import buildDealScope from "../utils/dealScope.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import getApprovalDetails from "../services/approvalServices.js";

// Get all deals accessible to the logged-in user
export const getDeals = async (req, res) => {
  try {
    const scope = buildDealScope(req.user);

    const deals = await Deal.find(scope)
      .populate("customerId", "name email")
      .populate("productId", "name sku price")
      .populate("ownerId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: deals.length,
      deals,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch deals",
      error: error.message,
    });
  }
};

// Get one deal by ID, only if it is within the user's scope
export const getDealById = async (req, res) => {
  try {
    const scope = buildDealScope(req.user);

    const deal = await Deal.findOne({
      _id: req.params.id,
      ...scope,
    })
      .populate("customerId", "name email")
      .populate("productId", "name sku price")
      .populate("ownerId", "name email");

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    return res.status(200).json({ deal });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch deal",
      error: error.message,
    });
  }
};


export const createDeal = async (req, res) => {
  try {
    const {
      title,
      customerId,
      productId,
      quantity,
      discountPercent = 0,
    } = req.body;

    if (!title || !customerId || !productId || !quantity) {
      return res.status(400).json({
        message: "Please provide all required deal details",
      });
    }

    const customer = await Customer.findById(customerId);
    const product = await Product.findById(productId);

    if (!customer || !product) {
      return res.status(404).json({
        message: "Customer or product not found",
      });
    }

    const approvalDetails = await getApprovalDetails(
  Number(discountPercent)
);

  const deal = await Deal.create({
  title,
  customerId,
  productId,
  quantity,
  unitPrice: product.price,
  ownerId: req.user._id,
  branchId: req.user.branchId,
  discountPercent: Number(discountPercent),

  // Approval workflow details
  ...approvalDetails,
});
    return res.status(201).json({
      message: "Deal created successfully",
      deal,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create deal",
      error: error.message,
    });
  }
};


export const convertDealToSale = async (req, res) => {
  try {
    const { dealId } = req.params;

    // Find the deal
    const deal = await Deal.findById(dealId);

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    // Check whether the deal is already converted
    if (deal.status === "won") {
      return res.status(409).json({
        message: "Deal has already been converted",
      });
    }

    // Only approved or automatically approved deals can be converted
    if (
      !["approved", "not_required"].includes(
        deal.approvalStatus
      )
    ) {
      return res.status(400).json({
        message: "Deal must be approved before conversion",
      });
    }

    // Check whether an invoice already exists
    const existingInvoice = await Invoice.findOne({ dealId });

    if (existingInvoice) {
      return res.status(409).json({
        message: "Invoice already exists for this deal",
        invoice: existingInvoice,
      });
    }

    // Calculate the final amount after discount
    const subtotal = deal.unitPrice * deal.quantity;

    const discountAmount =
      (subtotal * deal.discountPercent) / 100;

    const finalAmount = subtotal - discountAmount;

    // Create invoice locally before contacting BillPort
    const invoice = await Invoice.create({
      dealId: deal._id,
      customerId: deal.customerId,
      amount: finalAmount,
      idempotencyKey: crypto.randomUUID(),
      status: "queued",
      nextRetryAt: new Date(),
    });

    try {
      deal.status = "won";
      await deal.save();
    } catch (error) {
      // Avoid leaving an invoice behind if deal update fails
      await Invoice.findByIdAndDelete(invoice._id);
      throw error;
    }

    return res.status(201).json({
      message: "Deal converted successfully. Invoice queued for processing.",
      dealId: deal._id,
      invoice,
    });
  } catch (error) {
    console.error("Deal conversion error:", error);

    return res.status(500).json({
      message: "Failed to convert deal",
    });
  }
};
