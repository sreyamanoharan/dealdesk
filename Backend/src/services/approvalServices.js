
import ApprovalConfig from "../models/ApprovalConfig.js";

const getApprovalDetails = async (discountPercent) => {
  if (
    typeof discountPercent !== "number" ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    throw new Error("Invalid discount percentage");
  }

  // Read approval rules from MongoDB
  const config = await ApprovalConfig.findOne({
    name: "discount_approval",
  });

  if (!config) {
    throw new Error("Approval configuration not found");
  }

  // Find the matching discount band
  const band = config.bands.find((item) => {
    if (item.minDiscount === 0) {
      return discountPercent >= 0 &&
        discountPercent <= item.maxDiscount;
    }

    return discountPercent > item.minDiscount &&
      discountPercent <= item.maxDiscount;
  });

  if (!band) {
    throw new Error("No approval rule found for this discount");
  }

  // Automatic approval
  if (band.autoApprove) {
    return {
      approvalStatus: "not_required",
      approvalSteps: [],
      currentApprovalStep: 0,
    };
  }

  // Prepare sequential approval steps
  const approvalSteps = [...band.steps]
    .sort((a, b) => a.order - b.order)
    .map((step) => ({
      roleId: step.roleId,
      order: step.order,
      status: "pending",
    }));

  return {
    approvalStatus: "pending",
    approvalSteps,
    currentApprovalStep: 1,
  };
};

export default getApprovalDetails;
