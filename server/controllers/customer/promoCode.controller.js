import mongoose from "mongoose";

import Order from "../../models/Order.js";
import {
  validatePromoCode as validateService,
  applyPromoCode as applyService,
  removePromoCode as removeService,
} from "../../services/promoCode.service.js";

// --------------------------------------------------
// PREVIEW A PROMO CODE AT CHECKOUT
// POST /api/customer/promo-codes/validate  (body: { code, subtotal })
// --------------------------------------------------

export const validatePromoCode = async (req, res) => {
  try {
    const result = await validateService({
      code: req.body?.code,
      subtotal: req.body?.subtotal,
      userId: req.user?.userId,
    });

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Promo code applied — ₱${result.discount} off`,
      data: result,
    });
  } catch (err) {
    console.error("Validate promo code error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// APPLY A PROMO CODE TO AN ORDER
// POST /api/orders/:id/promo  (body: { code })
// --------------------------------------------------

export const applyPromoCode = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can apply promo codes",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: id, user: req.user.userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const result = await applyService({ order, code: req.body?.code });

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Promo code ${result.code} applied — ₱${result.discount} off`,
      data: {
        code: result.code,
        discount: result.discount,
        order: result.order,
      },
    });
  } catch (err) {
    console.error("Apply promo code error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// REMOVE A PROMO CODE FROM AN ORDER
// DELETE /api/orders/:id/promo
// --------------------------------------------------

export const removePromoCode = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can remove promo codes",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: id, user: req.user.userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const result = await removeService({ order });

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Promo code removed",
      data: { order: result.order },
    });
  } catch (err) {
    console.error("Remove promo code error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
