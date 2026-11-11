
import Chat from "../models/Chat.js";
import Deal from "../models/Deal.js";
import User from "../models/User.js";

// Get or create a chat thread for a deal
export const getDealChat = async (req, res) => {
  try {
    const { dealId } = req.params;

    const deal = await Deal.findById(dealId);

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    const scope = req.user.roleId.dataScope;

    // Check whether the user can access this deal
    const isOwner =
      String(deal.ownerId) === String(req.user._id);

    const isSameBranch =
      String(deal.branchId) === String(req.user.branchId);

    const canAccessDeal =
      isOwner ||
      scope === "all" ||
      (scope === "branch" && isSameBranch);

    if (!canAccessDeal) {
      return res.status(403).json({
        message: "You cannot access this deal chat",
      });
    }

    // Find existing chat
    let chat = await Chat.findOne({ dealId });

    if (!chat) {
      // Find the manager assigned to this deal's branch
      const managerRole = await req.user.constructor.db
        .model("Role")
        .findOne({ name: "sales_manager" });

      const managers = managerRole
        ? await User.find({
            roleId: managerRole._id,
            branchId: deal.branchId,
            isActive: true,
          }).select("_id")
        : [];

      const participants = [
        deal.ownerId,
        ...managers.map((manager) => manager._id),
      ];

      // Avoid duplicate participant IDs
      const uniqueParticipants = [
        ...new Map(
          participants.map((id) => [String(id), id])
        ).values(),
      ];

      chat = await Chat.create({
        dealId,
        participants: uniqueParticipants,
        messages: [],
      });
    } else if (
      !chat.participants.some(
        (id) => String(id) === String(req.user._id)
      )
    ) {
      return res.status(403).json({
        message: "You are not a participant in this chat",
      });
    }

    return res.status(200).json({ chat });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve chat",
      error: error.message,
    });
  }
};

// Get messages and unread count
export const getChatMessages = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      dealId: req.params.dealId,
      participants: req.user._id,
    }).populate("messages.senderId", "name email");

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found or access denied",
      });
    }

    const unreadCount = chat.messages.filter((message) => {
      return !message.readBy.some(
        (userId) => String(userId) === String(req.user._id)
      );
    }).length;

    return res.status(200).json({
      count: chat.messages.length,
      unreadCount,
      messages: chat.messages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch messages",
      error: error.message,
    });
  }
};
