
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Chat from "../models/Chat.js";

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Authenticate socket connection using JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.userId)
        .populate("roleId");

      if (!user || !user.isActive || !user.roleId?.isActive) {
        return next(new Error("Invalid or inactive user"));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.name}`);

    // Join a deal-specific chat room
    socket.on("chat:join", async ({ dealId } = {}) => {
      try {
        const chat = await Chat.findOne({
          dealId,
          participants: socket.user._id,
        });

        if (!chat) {
          return socket.emit("chat:error", {
            message: "Chat not found or access denied",
          });
        }

        const room = `deal:${dealId}`;
        await socket.join(room);

        socket.emit("chat:joined", {
          message: "Joined chat successfully",
          dealId,
        });
      } catch (error) {
        socket.emit("chat:error", {
          message: "Unable to join chat",
        });
      }
    });

    // Send and save a chat message
    socket.on("chat:send", async ({ dealId, message } = {}) => {
      try {
        if (!message || !message.trim()) {
          return socket.emit("chat:error", {
            message: "Message cannot be empty",
          });
        }

        const room = `deal:${dealId}`;

        if (!socket.rooms.has(room)) {
          return socket.emit("chat:error", {
            message: "Join the chat before sending messages",
          });
        }

        const chat = await Chat.findOne({
          dealId,
          participants: socket.user._id,
        });

        if (!chat) {
          return socket.emit("chat:error", {
            message: "Chat not found or access denied",
          });
        }

        const newMessage = {
          senderId: socket.user._id,
          message: message.trim(),
          readBy: [socket.user._id],
          createdAt: new Date(),
        };

        chat.messages.push(newMessage);
        await chat.save();

        const savedMessage = chat.messages[chat.messages.length - 1];

        // Deliver message to everyone in this deal's room
        io.to(room).emit("chat:message", {
          _id: savedMessage._id,
          dealId,
          senderId: socket.user._id,
          senderName: socket.user.name,
          message: savedMessage.message,
          createdAt: savedMessage.createdAt,
        });
      } catch (error) {
        socket.emit("chat:error", {
          message: "Failed to send message",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

export default initializeSocket;
