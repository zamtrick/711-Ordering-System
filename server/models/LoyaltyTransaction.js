import mongoose from "mongoose";

// Immutable ledger of every points movement for a customer. The account's
// `points` balance is always the sum of its transactions, so this doubles as
// an audit trail for admins and the customer's history screen.
const loyaltyTransactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // earn   → positive points from a completed order
    // redeem → negative points spent on an order
    // adjust → positive or negative manual admin correction
    // reverse→ negative clawback when an earned order is cancelled/refunded
    type: {
      type: String,
      enum: ["earn", "redeem", "adjust", "reverse"],
      required: true,
    },

    // Signed points: positive for earn/adjust-up, negative for redeem/down.
    points: {
      type: Number,
      required: true,
    },

    // Human-readable reason shown in the customer's history.
    reason: {
      type: String,
      trim: true,
      default: "",
    },

    // Order this movement is tied to (earn/redeem/reverse only).
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    // Account balance after this movement — lets the history render without
    // replaying the whole ledger.
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    // Who performed it (null = system).
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

loyaltyTransactionSchema.index({ customer: 1, createdAt: -1 });

const LoyaltyTransaction = mongoose.model(
  "LoyaltyTransaction",
  loyaltyTransactionSchema,
);

export default LoyaltyTransaction;
