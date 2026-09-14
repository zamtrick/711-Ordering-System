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

    // Per-order delivery chat (customer <-> assigned rider). Null for the
    // classic customer<->branch-admin support threads. One chat per order.
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    // The assigned rider's User id (only set on per-order delivery chats).
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

    unreadRider: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// One support thread per customer+branch pair (only where order == null,
// so per-order delivery chats never collide with it or each other)
conversationSchema.index(
  { customer: 1, branch: 1 },
  { unique: true, partialFilterExpression: { order: null } },
);
conversationSchema.index({ branch: 1, lastMessageAt: -1 });
// One delivery chat per order (sparse so branch threads with order=null
// never collide with each other)
conversationSchema.index({ order: 1 }, { unique: true, sparse: true });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
