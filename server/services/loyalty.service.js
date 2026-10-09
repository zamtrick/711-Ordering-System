import LoyaltyAccount from "../models/LoyaltyAccount.js";
import LoyaltyTransaction from "../models/LoyaltyTransaction.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { getLoyaltySettings } from "../controllers/settings.controller.js";

// --------------------------------------------------
// Tiering — derived from lifetime points earned.
// --------------------------------------------------
const TIERS = [
  { name: "Bronze", min: 0, color: "#B45309" },
  { name: "Silver", min: 500, color: "#64748B" },
  { name: "Gold", min: 2000, color: "#D97706" },
  { name: "Platinum", min: 5000, color: "#7C3AED" },
];

export const getTierForPoints = (lifetimeEarned = 0) => {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (lifetimeEarned >= t.min) tier = t;
  }
  const next = TIERS.find((t) => t.min > lifetimeEarned) ?? null;
  return {
    name: tier.name,
    color: tier.color,
    nextTier: next ? next.name : null,
    pointsToNext: next ? next.min - lifetimeEarned : 0,
  };
};

// --------------------------------------------------
// Account helpers
// --------------------------------------------------

export const getOrCreateAccount = async (customerId) => {
  let account = await LoyaltyAccount.findOne({ customer: customerId });
  if (!account) {
    account = await LoyaltyAccount.create({ customer: customerId });
  }
  return account;
};

/**
 * Points awarded for an order total, per the configured earn rate.
 * Always rounded down — customers never get fractional points.
 */
export const computeEarnedPoints = (totalAmount, settings) => {
  const rate = Number(settings?.earnPerPeso) || 0;
  const points = Math.floor((Number(totalAmount) || 0) * rate);
  return points > 0 ? points : 0;
};

/**
 * Award points for a completed order. Idempotent: an order already carrying
 * loyaltyPointsEarned > 0 is skipped, so the multiple delivery-completion
 * paths (rider status update, proof upload, admin, backdoor) can each call
 * this safely without double-crediting.
 */
export const awardOrderPoints = async (order, { createdBy = null } = {}) => {
  if (!order) return null;

  const settings = await getLoyaltySettings();
  if (!settings.enabled) return null;

  // Re-read to make the idempotency guard race-safe across concurrent paths.
  const fresh = await Order.findById(order._id).select(
    "loyaltyPointsEarned totalAmount user status",
  );
  if (!fresh || fresh.loyaltyPointsEarned > 0) return null;
  if (fresh.status !== "completed") return null;

  const points = computeEarnedPoints(fresh.totalAmount, settings);
  if (points <= 0) return null;

  // Claim the order first — only the winner proceeds to credit the account.
  const claimed = await Order.findOneAndUpdate(
    { _id: fresh._id, loyaltyPointsEarned: { $lte: 0 } },
    { $set: { loyaltyPointsEarned: points } },
    { new: true },
  );
  if (!claimed) return null;

  const account = await LoyaltyAccount.findOneAndUpdate(
    { customer: fresh.user },
    {
      $inc: { points, lifetimeEarned: points },
      $setOnInsert: { customer: fresh.user },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await LoyaltyTransaction.create({
    customer: fresh.user,
    type: "earn",
    points,
    reason: `Earned from order #${fresh._id.toString().slice(-6).toUpperCase()}`,
    order: fresh._id,
    balanceAfter: account.points,
    createdBy,
  });

  return { points, balance: account.points };
};

/**
 * Claw back points that were awarded for an order that was later cancelled or
 * refunded. Never drives the balance below zero — the negative transaction is
 * capped at whatever the customer still holds.
 */
export const reverseOrderPoints = async (order, { reason } = {}) => {
  if (!order) return null;

  const fresh = await Order.findById(order._id).select(
    "loyaltyPointsEarned loyaltyPointsRedeemed user status",
  );
  if (!fresh || fresh.loyaltyPointsEarned <= 0) return null;

  // Mark the order as reversed so this can only run once.
  const claimed = await Order.findOneAndUpdate(
    { _id: fresh._id, loyaltyPointsEarned: { $gt: 0 } },
    { $set: { loyaltyPointsEarned: 0 } },
    { new: true },
  );
  if (!claimed) return null;

  const account = await LoyaltyAccount.findOne({ customer: fresh.user });
  if (!account) return null;

  const points = Math.min(fresh.loyaltyPointsEarned, account.points);
  if (points <= 0) return null;

  account.points -= points;
  await account.save();

  await LoyaltyTransaction.create({
    customer: fresh.user,
    type: "reverse",
    points: -points,
    reason:
      reason ||
      `Reversed points for ${fresh.status} order #${fresh._id
        .toString()
        .slice(-6)
        .toUpperCase()}`,
    order: fresh._id,
    balanceAfter: account.points,
    createdBy: null,
  });

  return { points: -points, balance: account.points };
};

/**
 * Return points that were redeemed on an order that never completed (or was
 * cancelled/refunded). Symmetric to awardOrderPoints: the discount is undone
 * and the points are credited back. Idempotent — the order's
 * loyaltyPointsRedeemed field is zeroed as the one-shot marker.
 */
export const refundRedeemedPoints = async (order) => {
  if (!order) return null;

  const fresh = await Order.findById(order._id).select(
    "loyaltyPointsRedeemed user",
  );
  if (!fresh || fresh.loyaltyPointsRedeemed <= 0) return null;

  const points = fresh.loyaltyPointsRedeemed;

  // Claim first — only the winner proceeds to credit the account.
  const claimed = await Order.findOneAndUpdate(
    { _id: fresh._id, loyaltyPointsRedeemed: { $gt: 0 } },
    { $set: { loyaltyPointsRedeemed: 0, loyaltyDiscount: 0 } },
    { new: true },
  );
  if (!claimed) return null;

  const account = await LoyaltyAccount.findOneAndUpdate(
    { customer: fresh.user },
    { $inc: { points }, $setOnInsert: { customer: fresh.user } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await LoyaltyTransaction.create({
    customer: fresh.user,
    type: "reverse",
    points,
    reason: `Refunded for order #${fresh._id
      .toString()
      .slice(-6)
      .toUpperCase()}`,
    order: fresh._id,
    balanceAfter: account.points,
    createdBy: null,
  });

  return { points, balance: account.points };
};

/**
 * Redeem points against a pending order. Validates ownership/status/balance,
 * computes the peso discount, applies it to totalAmount atomically, debits the
 * account, and records a ledger entry. Only one redemption per order.
 */
export const redeemOrderPoints = async ({ order, customerId, points }) => {
  const settings = await getLoyaltySettings();
  if (!settings.enabled) {
    return { error: "Loyalty programme is disabled", status: 400 };
  }

  if (order.status !== "pending") {
    return {
      error: `Points can only be redeemed on pending orders`,
      status: 400,
    };
  }

  if (order.loyaltyPointsRedeemed > 0) {
    return { error: "This order already has points redeemed", status: 400 };
  }

  const requested = Math.floor(Number(points));
  if (!Number.isFinite(requested) || requested <= 0) {
    return { error: "Points must be a positive whole number", status: 400 };
  }

  if (requested < settings.minRedeemPoints) {
    return {
      error: `Minimum redemption is ${settings.minRedeemPoints} points`,
      status: 400,
    };
  }

  const blocks = Math.floor(requested / settings.redeemPoints);
  if (blocks <= 0) {
    return {
      error: `Points must be redeemable in blocks of ${settings.redeemPoints}`,
      status: 400,
    };
  }

  const pointsUsed = blocks * settings.redeemPoints;
  const rawDiscount = blocks * settings.redeemValue;

  // Can't discount below zero — cap at the order total.
  const discount = Math.min(rawDiscount, order.totalAmount);
  if (discount <= 0) {
    return { error: "Nothing left on this order to discount", status: 400 };
  }

  // Atomically debit the balance; the guard prevents overspending.
  const account = await LoyaltyAccount.findOneAndUpdate(
    { customer: customerId, points: { $gte: pointsUsed } },
    { $inc: { points: -pointsUsed, lifetimeRedeemed: pointsUsed } },
    { new: true },
  );
  if (!account) {
    return { error: "Not enough points for this redemption", status: 400 };
  }

  const updatedOrder = await Order.findByIdAndUpdate(
    order._id,
    {
      $inc: { totalAmount: -discount },
      $set: {
        loyaltyPointsRedeemed: pointsUsed,
        loyaltyDiscount: discount,
      },
    },
    { new: true },
  );

  // Keep Payment.amount in sync with the discounted order total — every other
  // path that mutates totalAmount (add/update/remove item) mirrors it here, so
  // receipts and analytics stay accurate.
  if (updatedOrder?.payment) {
    await Payment.findByIdAndUpdate(updatedOrder.payment, {
      amount: updatedOrder.totalAmount,
    });
  }

  await LoyaltyTransaction.create({
    customer: customerId,
    type: "redeem",
    points: -pointsUsed,
    reason: `Redeemed on order #${order._id
      .toString()
      .slice(-6)
      .toUpperCase()}`,
    order: order._id,
    balanceAfter: account.points,
    createdBy: null,
  });

  return {
    pointsUsed,
    discount,
    balance: account.points,
    order: updatedOrder,
  };
};
