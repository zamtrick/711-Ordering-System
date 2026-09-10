import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

// --------------------------------------------------
// GET OR CREATE the conversation for the logged-in customer
// GET /api/chat/conversation
// --------------------------------------------------
export const getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.user.userId;

    let convo = await Conversation.findOne({ customer: userId }).populate(
      "customer",
      "firstname lastname email",
    );

    if (!convo) {
      convo = await Conversation.create({ customer: userId });
      convo = await Conversation.findById(convo._id).populate(
        "customer",
        "firstname lastname email",
      );
    }

    return res.status(200).json({ success: true, data: convo });
  } catch (err) {
    console.error("getOrCreateConversation error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// GET ALL CONVERSATIONS  (admin view — list of customers)
// GET /api/chat/conversations
// --------------------------------------------------
export const getAllConversations = async (req, res) => {
  try {
    const convos = await Conversation.find()
      .populate("customer", "firstname lastname email")
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

    const convo = await Conversation.findById(conversationId);
    if (!convo) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    // Customers can only read their own conversation
    if (
      req.user.role === "customer" &&
      convo.customer.toString() !== req.user.userId
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const messages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .populate("sender", "firstname lastname");

    // Mark all messages as read for the requesting side
    const otherRole = req.user.role === "admin" ? "customer" : "admin";
    await Message.updateMany(
      { conversation: conversationId, senderRole: otherRole, read: false },
      { $set: { read: true } },
    );

    // Reset unread counter for this user's side
    if (req.user.role === "admin") {
      await Conversation.findByIdAndUpdate(conversationId, { unreadAdmin: 0 });
    } else {
      await Conversation.findByIdAndUpdate(conversationId, { unreadCustomer: 0 });
    }

    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    console.error("getMessages error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
