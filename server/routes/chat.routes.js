import express from "express";
import {
  getOrCreateConversation,
  getAllConversations,
  getMessages,
  getOrCreateOrderConversation,
  getMyDeliveryConversations,
} from "../controllers/chat.controller.js";
import auth from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { resolveStaffBranch } from "../middlewares/branchScope.middleware.js";

const router = express.Router();

// All chat routes require a valid session and (for staff) branch resolution:
// superadmins get req.adminBranchId = null (see everything), branch admins
// get their branch (scoped lists/access), customers pass through untouched.
router.use(auth, resolveStaffBranch);

// Customer — get or create their own conversation
router.get("/conversation", authorize("customer"), getOrCreateConversation);

// Admin — list all conversations (branch-scoped for branch admins)
router.get("/conversations", authorize("admin", "superadmin"), getAllConversations);

// Both sides — fetch messages (ownership + branch scope enforced in controller)
router.get(
  "/conversations/:conversationId/messages",
  authorize("customer", "admin", "superadmin", "rider"),
  getMessages,
);

// Per-order delivery chat (customer <-> assigned rider)
// GET /api/chat/order/:orderId
router.get(
  "/order/:orderId",
  authorize("customer", "rider"),
  getOrCreateOrderConversation,
);

// Rider — list my delivery chats (one per assigned order)
router.get("/my-deliveries", authorize("rider"), getMyDeliveryConversations);

export default router;
