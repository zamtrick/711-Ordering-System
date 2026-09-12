import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Order from "../models/Order.js";
import Branch from "../models/Branch.js";
import { isBranchScoped } from "../middlewares/branchScope.middleware.js";

// --------------------------------------------------
// BRANCH SCOPING FOR CHAT
// --------------------------------------------------
// Conversations link a customer to the "support team". A branch admin only
// handles customers of their branch — defined as customers who have placed
// an order there (Order.branch). Superadmins see every conversation.
// --------------------------------------------------

// Customer (User) ids that have ordered from the given branch
const branchCustomerUserIds = async (branchId) => {
  const rows = await Order.find({ branch: branchId }).select("user").lean();
  return [...new Set(rows.map((o) => o.user.toString()))];
};

// Access guard: can the requester open this conversation?
// Returns the conversation when allowed; sends the error response and
// returns null otherwise.
const findAccessibleConversation = async (req, res, conversationId) => {
  const convo = await Conversation.findById(conversationId);
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

  // Branch admins: only customers who ordered at their branch
  if (isBranchScoped(req)) {
    const ids = await branchCustomerUserIds(req.adminBranchId);
    if (!ids.includes(convo.customer.toString())) {
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
    // Branch admins see only their branch's customer conversations;
    // superadmins see all.
    const scoped = isBranchScoped(req);
    const query = scoped
      ? { customer: { $in: await branchCustomerUserIds(req.adminBranchId) } }
      : {};

    const convos = await Conversation.find(query)
      .populate("customer", "firstname lastname email")
      .sort({ lastMessageAt: -1 });

    // Superadmins get every conversation across branches, so annotate each
    // row with the branch(es) the customer has ordered from — the UI shows
    // a branch badge per conversation row. Branch admins only ever see one
    // branch, so the extra queries are skipped for them.
    if (!scoped && convos.length > 0) {
      const customerIds = convos.map((c) => c.customer?._id).filter(Boolean);
      const branchRows = await Order.aggregate([
        { $match: { user: { $in: customerIds } } },
        {
          $group: {
            _id: "$user",
            branches: { $addToSet: "$branch" },
          },
        },
      ]);

      // Resolve branch names in one query
      const branchIds = [
        ...new Set(branchRows.flatMap((r) => r.branches.map(String))),
      ];
      const branches = await Branch.find({ _id: { $in: branchIds } })
        .select("name branchCode")
        .lean();
      const branchMap = new Map(branches.map((b) => [b._id.toString(), b]));

      const branchByCustomer = new Map(
        branchRows.map((r) => [
          r._id.toString(),
          r.branches
            .map((id) => branchMap.get(id.toString()))
            .filter(Boolean),
        ]),
      );

      const data = convos.map((c) => {
        const plain = c.toObject();
        plain.customerBranches =
          branchByCustomer.get(plain.customer?._id?.toString()) ?? [];
        return plain;
      });

      return res.status(200).json({ success: true, data });
    }

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
