
import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import requirePermission from "../middleware/permissionMiddleware.js";
import {
  getDeals,
  getDealById,
  createDeal
} from "../controllers/dealController.js";
import { convertDealToSale } from "../controllers/dealController.js";

const router = express.Router();

// Get all deals

// Create a new deal
router.post(
  "/",
  authenticateUser,
  requirePermission("deal.edit"),
  createDeal
);

router.get(
  "/",
  authenticateUser,
  requirePermission("deal.view"),
  getDeals
);

// Get a single deal by ID
router.get(
  "/:id",
  authenticateUser,
  requirePermission("deal.view"),
  getDealById
);
router.post(
  "/:dealId/convert",
  authenticateUser,
  requirePermission("invoice.issue"),
  convertDealToSale
);

export default router;
