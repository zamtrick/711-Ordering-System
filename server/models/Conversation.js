import mongoose from "mongoose";

/**
 * Conversation — one thread between a customer and the admin/branch.
 * A customer can only have one active conversation at a time.
 */
const conversationSchema = new mongoose.Schema(
  {
    // The customer (User with role "customer")
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one conversation per customer
    },

    // Snapshot of the last message for the list view
    lastMessage: {
      type: String,
      default: "",
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },

    // Unread counters — incremented on new message, reset on open
    unreadAdmin: {
      type: Number,
      default: 0,
      min: 0,
    },

    unreadCustomer: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
