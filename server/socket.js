import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";

// --------------------------------------------------
// Rooms
// --------------------------------------------------
// customer:{userId}   — the customer's private room
// admin_room          — all connected admins join this
// riders_room         — all connected riders join this
// conv:{convId}       — both sides join when the conversation is open

// --------------------------------------------------
// Shared io instance + order update emitter
// --------------------------------------------------

let ioInstance = null;

export const getIo = () => ioInstance;

export const emitOrderUpdated = (order) => {
  try {
    if (!ioInstance || !order) return;
    const rawUser = order.user?._id ?? order.user;
    const userId = rawUser?.toString?.() ?? rawUser;
    const payload =
      typeof order.toJSON === "function" ? order.toJSON() : order;
    if (userId) {
      ioInstance.to(`customer:${userId}`).emit("order_updated", payload);
    }
    ioInstance.to("admin_room").emit("order_updated", payload);
    ioInstance.to("riders_room").emit("order_updated", payload);
  } catch {
    // never break the request path on socket errors
  }
};

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, true), // inherits same policy as Express
      credentials: true,
    },
  });

  // --------------------------------------------------
  // Auth middleware — verify JWT cookie before handshake
  // --------------------------------------------------
  io.use((socket, next) => {
    try {
      const raw =
        socket.handshake.headers.cookie ?? socket.handshake.auth.cookie ?? "";
      const cookies = cookie.parse(raw);
      const token = cookies.accessToken ?? socket.handshake.auth.token;

      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { userId, role, ... }
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  // --------------------------------------------------
  // Connection
  // --------------------------------------------------
  io.on("connection", async (socket) => {
    const { userId, role } = socket.user;

    // Every admin joins the shared admin room so any admin can receive pings
    if (role === "admin" || role === "superadmin") {
      socket.join("admin_room");
    }

    // Customers join their own private room so the server can push to them
    if (role === "customer") {
      socket.join(`customer:${userId}`);
    }

    // Riders share one room for new/cancelled delivery broadcasts.
    // Assignment-specific routing is done client-side via order.rider.
    if (role === "rider") {
      socket.join("riders_room");
    }

    // ── join_conversation ──────────────────────────
    // Client emits this when they open a conversation pane.
    // Both the customer and the admin join the same conv room.
    socket.on("join_conversation", async ({ conversationId }) => {
      if (!conversationId) return;

      const convo = await Conversation.findById(conversationId);
      if (!convo) return;

      // Customers can only join their own conversation
      if (role === "customer" && convo.customer.toString() !== userId) return;

      socket.join(`conv:${conversationId}`);

      // Reset unread counter and mark messages read for this side
      const otherRole = role === "admin" ? "customer" : "admin";
      await Message.updateMany(
        { conversation: conversationId, senderRole: otherRole, read: false },
        { $set: { read: true } },
      );

      if (role === "admin") {
        await Conversation.findByIdAndUpdate(conversationId, { unreadAdmin: 0 });
        // Tell the admin's other tabs the count is cleared
        io.to("admin_room").emit("conversation_updated", {
          conversationId,
          unreadAdmin: 0,
        });
      } else {
        await Conversation.findByIdAndUpdate(conversationId, { unreadCustomer: 0 });
        io.to(`customer:${userId}`).emit("conversation_updated", {
          conversationId,
          unreadCustomer: 0,
        });
      }
    });

    // ── leave_conversation ─────────────────────────
    socket.on("leave_conversation", ({ conversationId }) => {
      if (conversationId) socket.leave(`conv:${conversationId}`);
    });

    // ── send_message ───────────────────────────────
    socket.on("send_message", async ({ conversationId, text }, ack) => {
      try {
        if (!conversationId || !text?.trim()) {
          return ack?.({ success: false, message: "Missing fields" });
        }

        const convo = await Conversation.findById(conversationId);
        if (!convo) return ack?.({ success: false, message: "Conversation not found" });

        // Ownership guard
        if (role === "customer" && convo.customer.toString() !== userId) {
          return ack?.({ success: false, message: "Forbidden" });
        }

        const senderRole = role === "admin" || role === "superadmin" ? "admin" : "customer";

        // Persist
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          senderRole,
          text: text.trim(),
        });

        const populated = await Message.findById(message._id).populate(
          "sender",
          "firstname lastname",
        );

        // Update conversation snapshot
        const unreadUpdate =
          senderRole === "customer"
            ? { $inc: { unreadAdmin: 1 } }
            : { $inc: { unreadCustomer: 1 } };

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: text.trim(),
          lastMessageAt: new Date(),
          ...unreadUpdate,
        });

        const updatedConvo = await Conversation.findById(conversationId).populate(
          "customer",
          "firstname lastname email",
        );

        // Broadcast the message to everyone in this conversation room
        io.to(`conv:${conversationId}`).emit("new_message", populated);

        // Notify the other side even if they haven't opened the convo pane
        if (senderRole === "customer") {
          io.to("admin_room").emit("conversation_updated", updatedConvo);
        } else {
          io.to(`customer:${convo.customer.toString()}`).emit(
            "conversation_updated",
            updatedConvo,
          );
        }

        ack?.({ success: true, data: populated });
      } catch (err) {
        console.error("send_message error:", err.message);
        ack?.({ success: false, message: "Server error" });
      }
    });

    socket.on("disconnect", () => {
      // rooms are cleaned up automatically by socket.io
    });
  });

  ioInstance = io;
  return io;
};
