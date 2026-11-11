
import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";

import {
  getDealChat,
  getChatMessages,
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/:dealId", authenticateUser, getDealChat);

router.get(
  "/:dealId/messages",
  authenticateUser,
  getChatMessages
);

export default router;
