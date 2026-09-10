import express from "express";
import {
  getOrCreateConversation,
  getAllConversations,
  getMessages,
} from "../controllers/chat.controller.js";
import auth from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = express.Router();

// Customer — get or create their own conversation
router.get("/conversation", auth, authorize("customer"), getOrCreateConversation);

// Admin — list all conversations
router.get("/conversations", auth, authorize("admin", "superadmin"), getAllConversations);

// Both sides — fetch messages (ownership enforced in controller)
router.get(
  "/conversations/:conversationId/messages",
  auth,
  authorize("customer", "admin", "superadmin"),
  getMessages,
);

export default router;
