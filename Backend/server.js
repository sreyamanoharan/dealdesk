import dotenv from "dotenv";
dotenv.config();
import { startInvoiceWorker } from "./src/workers/invoiceWorker.js";
import { createServer } from "node:http";
import initializeSocket from "./src/sockets/socket.js";
import dns from "node:dns";
import express from "express";
import cors from "cors";
import connectDB from "./src/config/db.js";
import dealRoutes from "./src/routes/dealRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import approvalRoutes from "./src/routes/approvalRoutes.js";
import chatRoutes from "./src/routes/chatRoute.js";
import webhookRoutes from "./src/routes/webhookRoutes.js";

 dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();

app.use(cors());

app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  })
);

app.use("/api/deals", dealRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/webhooks", webhookRoutes);
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to DealDesk API",
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
 
    
  await connectDB();

const httpServer = createServer(app);

initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
   startInvoiceWorker();
});
};

startServer();