
import Deal from "../models/Deal.js";
import ApprovalHistory from "../models/ApprovalHistory.js";

// Common approval decision handler
const handleApprovalDecision = async (req, res, action) => {
  try {
    const { dealId } = req.params;
    const { comment = "" } = req.body;

    const deal = await Deal.findById(dealId);

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    if (deal.approvalStatus !== "pending") {
      return res.status(400).json({
        message: "This deal is not awaiting approval",
      });
    }

    // Prevent the deal owner from approving their own deal
    if (String(deal.ownerId) === String(req.user._id)) {
      return res.status(403).json({
        message: "You cannot approve your own deal",
      });
    }

    // Find the current approval step
    const currentStep = deal.approvalSteps.find(
      (step) => step.order === deal.currentApprovalStep
    );

    if (!currentStep) {
      return res.status(400).json({
        message: "Current approval step not found",
      });
    }

    // Check whether this user's role matches the current step
    if (
      String(currentStep.roleId) !==
      String(req.user.roleId._id)
    ) {
      return res.status(409).json({
        message: "It is not your turn to approve this deal",
      });
    }

    // Record the decision in the current step
    currentStep.status = action;
    currentStep.approvedBy = req.user._id;
    currentStep.actedAt = new Date();
    currentStep.comment = comment;

    // Save the decision in append-only history
    await ApprovalHistory.create({
      dealId: deal._id,
      stepOrder: currentStep.order,
      approverRoleId: req.user.roleId._id,
      approverUserId: req.user._id,
      action,
      comment,
    });

    if (action === "rejected") {
      deal.approvalStatus = "rejected";
      deal.currentApprovalStep = 0;
      deal.status = "open";

      // Reset the chain for a future resubmission.
      // The rejection remains permanently recorded in history.
      deal.approvalSteps.forEach((step) => {
        step.status = "pending";
        step.approvedBy = undefined;
        step.actedAt = undefined;
        step.comment = "";
      });
    } else {
      const nextStep = deal.approvalSteps.find(
        (step) => step.order === deal.currentApprovalStep + 1
      );

      if (nextStep) {
        deal.currentApprovalStep += 1;
      } else {
        deal.approvalStatus = "approved";
      }
    }

    await deal.save();

    return res.status(200).json({
      message: `Deal ${action} successfully`,
      deal,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Approval decision failed",
      error: error.message,
    });
  }
};

export const approveDeal = (req, res) => {
  return handleApprovalDecision(req, res, "approved");
};

export const rejectDeal = (req, res) => {
  return handleApprovalDecision(req, res, "rejected");
};


import buildDealScope from "../utils/dealScope.js";

export const getPendingApprovals = async (req, res) => {
  try {
    const scope = buildDealScope(req.user);

    const deals = await Deal.find({
      ...scope,
      approvalStatus: "pending",
      "approvalSteps.roleId": req.user.roleId._id,
    })
      .populate("customerId", "name email")
      .populate("ownerId", "name email")
      .populate("approvalSteps.roleId", "name")
      .sort({ createdAt: -1 });

    // Only return deals where this user's role
    // is responsible for the current step
    const pendingDeals = deals.filter((deal) => {
      const currentStep = deal.approvalSteps.find(
        (step) => step.order === deal.currentApprovalStep
      );

      return (
        currentStep &&
        currentStep.status === "pending" &&
        String(currentStep.roleId?._id || currentStep.roleId) ===
          String(req.user.roleId._id)
      );
    });

    return res.status(200).json({
      count: pendingDeals.length,
      deals: pendingDeals,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch pending approvals",
      error: error.message,
    });
  }
};
