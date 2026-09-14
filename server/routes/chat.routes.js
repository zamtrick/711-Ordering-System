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

// All chat routes require a valid session. Branch resolution only applies
// to admins/superadmins (branch-scoped conversation lists); customers and
// riders pass through untouched — riders have no Admin doc, so running them
// through resolveAdminBranch would 403 "No branch assigned to this admin
// account" and block the per-order delivery chat entirely. Rider access is
// enforced per-route in the controllers (conversation ownership checks).
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
