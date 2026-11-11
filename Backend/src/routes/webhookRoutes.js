
import express from "express";
import {
  receiveBillPortWebhook,
} from "../controllers/webhookController.js";

const router = express.Router();

router.post(
  "/billport",
  receiveBillPortWebhook
);

export default router;
