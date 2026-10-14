import PromoCode from "../models/PromoCode.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";

// --------------------------------------------------
// PROMO CODE SERVICE
// --------------------------------------------------
// Discounts apply to the ITEMS subtotal only — the delivery fee is always
// charged in full. Promo codes stack with loyalty redemption.
//
// totalAmount composition at any point in an order's life:
//   deliveryFee + itemsSubtotal - loyaltyDiscount - promoDiscount
// so the items subtotal can always be recovered as:
//   totalAmount - deliveryFee + loyaltyDiscount
// --------------------------------------------------

const normalizeCode = (code) => String(code ?? "").trim().toUpperCase();

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Number of orders for this customer currently holding the given code — a
 * per-user slot stays consumed while the order is pending or beyond, and is
 * released when the code is removed or the order is cancelled/refunded.
 */
const countUserUsage = async ({ userId, code }) => {
  if (!userId) return 0;
  return Order.countDocuments({
    user: userId,
    promoCode: code,
    promoSlotsReturned: { $ne: true },
  });
};

/**
 * Recover the items-only subtotal from an order's stored totals, independent
 * of whether loyalty was redeemed before or after this promo code.
 */
export const getItemsSubtotal = (order) => {
  const itemsSubtotal =
    (Number(order?.totalAmount) || 0) -
    (Number(order?.deliveryFee) || 0) +
    (Number(order?.loyaltyDiscount) || 0);
  return itemsSubtotal > 0 ? itemsSubtotal : 0;
};

/**
 * Look up a code and confirm it is active, within its scheduling window and
 * not already at its global usage cap. Returns { error, status } on failure,
 * or { promoCode } on success.
 */
export const resolvePromoCode = async (code) => {
  const normalized = normalizeCode(code);
  if (!normalized) {
    return { error: "Promo code is required", status: 400 };
  }

  const promoCode = await PromoCode.findOne({ code: normalized });
  if (!promoCode) {
    return { error: "Invalid promo code", status: 404 };
  }

  if (!promoCode.isActive) {
    return { error: "This promo code is no longer active", status: 400 };
  }

  const now = Date.now();
  if (promoCode.startsAt && promoCode.startsAt.getTime() > now) {
    return { error: "This promo code is not active yet", status: 400 };
  }
  if (promoCode.endsAt && promoCode.endsAt.getTime() < now) {
    return { error: "This promo code has expired", status: 400 };
  }

  if (Number.isInteger(promoCode.maxUses) && promoCode.usedCount >= promoCode.maxUses) {
    return { error: "This promo code has reached its usage limit", status: 400 };
  }

  return { promoCode };
};

/**
 * Usage/eligibility checks shared by the checkout preview and the real apply:
 * per-user cap and minimum order amount. Returns { error, status } on failure.
 */
const checkEligibility = async ({ userId, promoCode, itemsSubtotal }) => {
  if (Number.isInteger(promoCode.perUserLimit)) {
    const userUsage = await countUserUsage({ userId, code: promoCode.code });
    if (userUsage >= promoCode.perUserLimit) {
      return { error: "You have already used this promo code the maximum number of times", status: 400 };
    }
  }

  const minOrder = Number(promoCode.minOrderAmount) || 0;
  if (minOrder > 0 && (Number(itemsSubtotal) || 0) < minOrder) {
    return {
      error: `This code requires a minimum order of ₱${minOrder.toFixed(2)}`,
      status: 400,
    };
  }

  return {};
};

/**
 * Peso discount a code yields on a given items subtotal. Percent discounts
 * are capped by maxDiscount (when set) and the discount can never exceed the
 * items subtotal.
 */
export const computeDiscount = (promoCode, itemsSubtotal) => {
  const subtotal = Math.max(0, Number(itemsSubtotal) || 0);
  if (subtotal <= 0) return 0;

  const value = Number(promoCode?.value) || 0;
  let raw = promoCode?.type === "percent" ? (subtotal * value) / 100 : value;

  const maxDiscount = Number(promoCode?.maxDiscount);
  if (Number.isFinite(maxDiscount) && maxDiscount > 0) {
    raw = Math.min(raw, maxDiscount);
  }

  return round2(Math.min(raw, subtotal));
};

/**
 * Preview a code against a client-computed subtotal. Advisory only — the
 * authoritative discount is recomputed at apply time from the real order.
 * Passing userId enables per-user limit checks at checkout.
 */
export const validatePromoCode = async ({ code, subtotal, userId }) => {
  const resolved = await resolvePromoCode(code);
  if (resolved.error) return resolved;

  const eligibility = await checkEligibility({
    userId,
    promoCode: resolved.promoCode,
    itemsSubtotal: subtotal,
  });
  if (eligibility.error) return eligibility;

  const discount = computeDiscount(resolved.promoCode, subtotal);
  if (discount <= 0) {
    return { error: "This promo code gives no discount on this order", status: 400 };
  }

  return {
    code: resolved.promoCode.code,
    type: resolved.promoCode.type,
    value: resolved.promoCode.value,
    description: resolved.promoCode.description,
    discount,
  };
};

/**
 * Apply a promo code to a pending order. One code per order. Mirrors the
 * loyalty redeem service: business-rule failures return { error, status }
 * rather than throwing, and the discount is applied with an atomic guarded
 * update so concurrent requests can't apply two codes — or overrun the
 * code's global usage cap.
 */
export const applyPromoCode = async ({ order, code }) => {
  if (!order) return { error: "Order not found", status: 404 };

  if (order.status !== "pending") {
    return { error: "Promo codes can only be applied to pending orders", status: 400 };
  }

  if (order.promoCode) {
    return { error: "This order already has a promo code applied", status: 400 };
  }

  const resolved = await resolvePromoCode(code);
  if (resolved.error) return resolved;

  const subtotal = getItemsSubtotal(order);

  const eligibility = await checkEligibility({
    userId: order.user,
    promoCode: resolved.promoCode,
    itemsSubtotal: subtotal,
  });
  if (eligibility.error) return eligibility;

  // Discount the items subtotal, but never more than the order still owes —
  // promo codes stack with loyalty redemption, so together they must not
  // drive totalAmount below zero.
  const rawDiscount = computeDiscount(resolved.promoCode, subtotal);
  const discount = Math.min(rawDiscount, Math.max(0, Number(order.totalAmount) || 0));
  if (discount <= 0) {
    return { error: "This promo code gives no discount on this order", status: 400 };
  }

  // Claim one of the code's global usage slots first — this is the atomic
  // guard that stops concurrent requests overrunning maxUses. The promoCode
  // field on the order is the guard for one-code-per-order: only the first
  // request wins that, and any loser gets their slot returned below.
  const claimed = await PromoCode.findOneAndUpdate(
    {
      _id: resolved.promoCode._id,
      $or: [
        { maxUses: null },
        { $expr: { $lt: ["$usedCount", "$maxUses"] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  );
  if (!claimed) {
    return { error: "This promo code has reached its usage limit", status: 400 };
  }

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order._id, promoCode: "" },
    {
      $inc: { totalAmount: -discount },
      $set: { promoCode: resolved.promoCode.code, promoDiscount: discount },
    },
    { new: true },
  );

  if (!updatedOrder) {
    // A concurrent request applied a different code first — give the slot back.
    await PromoCode.updateOne(
      { _id: resolved.promoCode._id, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
    );
    return { error: "This order already has a promo code applied", status: 400 };
  }

  // Keep Payment.amount in sync with the discounted total.
  if (updatedOrder.payment) {
    await Payment.findByIdAndUpdate(updatedOrder.payment, {
      amount: updatedOrder.totalAmount,
    });
  }

  return {
    code: resolved.promoCode.code,
    discount,
    order: updatedOrder,
  };
};

/**
 * Remove the promo code from a pending order, restore the discounted amount
 * and release the code's global usage slot. The promoDiscount value is read
 * fresh so the restore is exact.
 */
export const removePromoCode = async ({ order }) => {
  if (!order) return { error: "Order not found", status: 404 };

  if (order.status !== "pending") {
    return { error: "Promo codes can only be removed from pending orders", status: 400 };
  }

  if (!order.promoCode) {
    return { error: "This order has no promo code applied", status: 400 };
  }

  const fresh = await Order.findById(order._id).select("promoCode promoDiscount");
  const restore = Number(fresh?.promoDiscount) || 0;

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order._id, promoCode: { $ne: "" } },
    {
      $inc: { totalAmount: restore },
      $set: { promoCode: "", promoDiscount: 0 },
    },
    { new: true },
  );

  if (!updatedOrder) {
    return { error: "This order has no promo code applied", status: 400 };
  }

  // Let the freed slot go back into the pool so it can be used again.
  if (fresh?.promoCode) {
    await PromoCode.updateOne(
      { code: fresh.promoCode, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
    );
  }

  if (updatedOrder.payment) {
    await Payment.findByIdAndUpdate(updatedOrder.payment, {
      amount: updatedOrder.totalAmount,
    });
  }

  return { code: fresh?.promoCode ?? "", discount: restore, order: updatedOrder };
};

/**
 * Release the promo usage slot held by an order that was cancelled or
 * refunded, so the cap reclaims the slot for other customers. Idempotent —
 * the order's promoSlotsReturned flag is the one-shot marker, mirroring the
 * loyalty reverse helpers.
 */
export const refundPromoCodeUsage = async (order) => {
  if (!order) return null;

  const fresh = await Order.findById(order._id).select(
    "promoCode promoSlotsReturned",
  );
  if (!fresh?.promoCode || fresh.promoSlotsReturned) return null;

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, promoCode: { $ne: "" }, promoSlotsReturned: { $ne: true } },
    { $set: { promoSlotsReturned: true } },
    { new: true },
  );
  if (!claimed) return null;

  await PromoCode.updateOne(
    { code: fresh.promoCode, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );

  return { code: fresh.promoCode };
};
