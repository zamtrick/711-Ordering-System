import mongoose from "mongoose";

/**
 * Conversation — one thread between a customer and a specific branch.
 * A customer can have one conversation per branch.
 */
const conversationSchema = new mongoose.Schema(
  {
    // The customer (User with role "customer")
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The branch this conversation is scoped to.
    // Branch admins only see conversations for their branch.
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
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

// One conversation per customer+branch pair
conversationSchema.index({ customer: 1, branch: 1 }, { unique: true });
conversationSchema.index({ branch: 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
