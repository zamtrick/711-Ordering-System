import mongoose from "mongoose";

// One loyalty account per customer. `points` is the spendable balance;
// lifetimeEarned/lifetimeRedeemed are monotonic counters used for tiering.
const loyaltyAccountSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    points: {
      type: Number,
      default: 0,
      min: 0,
    },

    lifetimeEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    lifetimeRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

const LoyaltyAccount = mongoose.model("LoyaltyAccount", loyaltyAccountSchema);

export default LoyaltyAccount;
