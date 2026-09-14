import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Branch from "../models/Branch.js";
import Order from "../models/Order.js";
import Rider from "../models/Rider.js";
import { isBranchScoped } from "../middlewares/branchScope.middleware.js";

// --------------------------------------------------
// Access guard — can the requester open this conversation?
// Returns the conversation when allowed; sends the 403/404 and returns null.
// --------------------------------------------------
const findAccessibleConversation = async (req, res, conversationId) => {
  const convo = await Conversation.findById(conversationId).populate("branch", "name branchCode");
  if (!convo) {
    res.status(404).json({ success: false, message: "Conversation not found" });
    return null;
  }

  if (req.user.role === "customer") {
    if (convo.customer.toString() !== req.user.userId) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return null;
    }
    return convo;
  }

  // Assigned rider: only the delivery chat of their own order.
  if (req.user.role === "rider") {
    if (!convo.rider || convo.rider.toString() !== req.user.userId) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return null;
    }
    return convo;
  }

  // Branch admins: only conversations belonging to their branch.
  // Legacy conversations without a branch field are allowed through.
  if (isBranchScoped(req)) {
    if (convo.branch && convo.branch.toString() !== req.adminBranchId?.toString()) {
      res.status(403).json({
        success: false,
        message: "You can only chat with customers of your branch.",
      });
      return null;
    }
  }

  return convo;
};

// --------------------------------------------------
// GET OR CREATE the conversation for the logged-in customer
// GET /api/chat/conversation?branchId=<id>
// --------------------------------------------------
export const getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { branchId } = req.query;

    if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "branchId query parameter is required",
      });
    }

    // Verify the branch exists
    const branch = await Branch.findById(branchId).select("name branchCode");
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    // Find or create one conversation per customer+branch (support threads
    // only — order chats carry order != null and must never collide here)
    let convo = await Conversation.findOne({ customer: userId, branch: branchId, order: null })
      .populate("customer", "firstname lastname email")
      .populate("branch", "name branchCode");

    if (!convo) {
      convo = await Conversation.create({ customer: userId, branch: branchId, order: null });
      convo = await Conversation.findById(convo._id)
        .populate("customer", "firstname lastname email")
        .populate("branch", "name branchCode");
    }

    return res.status(200).json({ success: true, data: convo });
  } catch (err) {
    console.error("getOrCreateConversation error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// GET ALL CONVERSATIONS  (admin view — list of customers)
// GET /api/chat/conversations[?branchId=<id>]
// --------------------------------------------------
export const getAllConversations = async (req, res) => {
  try {
    const scoped = isBranchScoped(req);

    let query = {};

    if (scoped) {
      // Branch admin — only their branch
      query.branch = req.adminBranchId;
    } else if (req.query.branchId) {
      // Superadmin filtered by a specific branch via query param
      if (!mongoose.Types.ObjectId.isValid(req.query.branchId)) {
        return res.status(400).json({ success: false, message: "Invalid branchId" });
      }
      query.branch = req.query.branchId;
    }
    // else superadmin with no filter → all conversations

    const convos = await Conversation.find(query)
      .populate("customer", "firstname lastname email")
      .populate("branch", "name branchCode")
      .sort({ lastMessageAt: -1 });

    return res.status(200).json({ success: true, data: convos });
  } catch (err) {
    console.error("getAllConversations error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// GET MESSAGES for a conversation
// GET /api/chat/conversations/:conversationId/messages
// --------------------------------------------------
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation ID" });
    }

    const convo = await findAccessibleConversation(req, res, conversationId);
    if (!convo) return;

    const messages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .populate("sender", "firstname lastname");

    // Mark all messages as read for the requesting side
    const otherRole = req.user.role === "rider" ? "customer" : req.user.role === "customer" ? "rider" : "customer";
    await Message.updateMany(
      { conversation: conversationId, senderRole: otherRole, read: false },
      { $set: { read: true } },
    );

    // Reset unread counter for this user's side
    if (req.user.role === "admin" || req.user.role === "superadmin") {
      await Conversation.findByIdAndUpdate(conversationId, { unreadAdmin: 0 });
    } else if (req.user.role === "rider") {
      await Conversation.findByIdAndUpdate(conversationId, { unreadRider: 0 });
    } else {
      await Conversation.findByIdAndUpdate(conversationId, { unreadCustomer: 0 });
    }

    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    console.error("getMessages error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// GET OR CREATE the per-order delivery chat
// GET /api/chat/order/:orderId
// Customer: must own the order. Rider: must be the assigned rider.
// The chat exists once a rider is assigned; admin can read via the
// normal conversation endpoints (branch scope).
// --------------------------------------------------
export const getOrCreateOrderConversation = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId)
      .populate("user", "firstname lastname email")
      .populate("branch", "name branchCode");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (req.user.role === "customer") {
      if (order.user?._id?.toString() !== req.user.userId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    } else if (req.user.role === "rider") {
      const rider = await Rider.findOne({ user: req.user.userId }).select("_id");
      if (!rider || order.rider?.toString() !== rider._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Only the assigned rider can chat on this order",
        });
      }
    } else {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (!order.rider) {
      return res.status(400).json({
        success: false,
        message: "No rider assigned yet — chat opens once a rider takes your order",
      });
    }

    // The rider's User id anchors the chat (stable even if Rider docs change)
    const riderDoc = await Rider.findById(order.rider).select("user");
    if (!riderDoc) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    let convo = await Conversation.findOne({ order: orderId })
      .populate("customer", "firstname lastname email")
      .populate("rider", "firstname lastname")
      .populate("branch", "name branchCode")
      .populate("order", "status deliveryStatus");

    if (!convo) {
      try {
        convo = await Conversation.create({
          customer: order.user._id,
          branch: order.branch._id,
          order: orderId,
          rider: riderDoc.user,
        });
      } catch (err) {
        // Race: two sides opened at once — reuse the winner (unique order index)
        if (err?.code !== 11000) throw err;
      }
      convo = await Conversation.findOne({ order: orderId })
        .populate("customer", "firstname lastname email")
        .populate("rider", "firstname lastname")
        .populate("branch", "name branchCode")
        .populate("order", "status deliveryStatus");
    }

    return res.status(200).json({ success: true, data: convo });
  } catch (err) {
    console.error("getOrCreateOrderConversation error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// LIST my delivery chats (rider view — one per assigned order)
// GET /api/chat/my-deliveries
// --------------------------------------------------
export const getMyDeliveryConversations = async (req, res) => {
  try {
    const convos = await Conversation.find({ rider: req.user.userId, order: { $ne: null } })
      .populate("customer", "firstname lastname")
      .populate("rider", "firstname lastname")
      .populate("branch", "name branchCode")
      .populate("order", "status deliveryStatus")
      .sort({ lastMessageAt: -1 });

    return res.status(200).json({ success: true, data: convos });
  } catch (err) {
    console.error("getMyDeliveryConversations error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
