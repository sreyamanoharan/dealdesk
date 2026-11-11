
import express from "express";

import authenticateUser from "../middleware/authMiddleware.js";
import requirePermission from "../middleware/permissionMiddleware.js";

import {
  approveDeal,
  rejectDeal,
   getPendingApprovals,
} from "../controllers/approvalController.js";

const router = express.Router();

router.get(
  "/pending",
  authenticateUser,
  requirePermission("discount.approve"),
  getPendingApprovals
);
// Approve a deal
router.post(
  "/:dealId/approve",
  authenticateUser,
  requirePermission("discount.approve"),
  approveDeal
);

// Reject a deal
router.post(
  "/:dealId/reject",
  authenticateUser,
  requirePermission("discount.approve"),
  rejectDeal
);

export default router;
