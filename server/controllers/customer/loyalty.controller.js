import mongoose from "mongoose";

import LoyaltyAccount from "../../models/LoyaltyAccount.js";
import LoyaltyTransaction from "../../models/LoyaltyTransaction.js";
import Order from "../../models/Order.js";
import { getLoyaltySettings } from "../settings.controller.js";
import {
  getOrCreateAccount,
  getTierForPoints,
  redeemOrderPoints as redeemService,
} from "../../services/loyalty.service.js";

// --------------------------------------------------
// GET MY LOYALTY SUMMARY
// GET /api/customer/loyalty
// --------------------------------------------------

export const getMyLoyalty = async (req, res) => {
  try {
    const customerId = req.user.userId;
    const [account, settings] = await Promise.all([
      getOrCreateAccount(customerId),
      getLoyaltySettings(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        points: account.points,
        lifetimeEarned: account.lifetimeEarned,
        lifetimeRedeemed: account.lifetimeRedeemed,
        tier: getTierForPoints(account.lifetimeEarned),
        settings,
      },
    });
  } catch (err) {
    console.error("Get loyalty error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// GET MY LOYALTY HISTORY
// GET /api/customer/loyalty/transactions?page=1&limit=20
// --------------------------------------------------

export const getMyLoyaltyHistory = async (req, res) => {
  try {
    const customerId = req.user.userId;

    const pageParam = Number(req.query.page);
    const limitParam = Number(req.query.limit);
    const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam >= 1
        ? Math.min(Math.floor(limitParam), 50)
        : 20;

    const [transactions, total] = await Promise.all([
      LoyaltyTransaction.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      LoyaltyTransaction.countDocuments({ customer: customerId }),
    ]);

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasMore: page * limit < total,
      },
    });
  } catch (err) {
    console.error("Get loyalty history error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// REDEEM POINTS ON AN ORDER
// POST /api/orders/:id/redeem  (body: { points })
// --------------------------------------------------

export const redeemOrderPoints = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can redeem loyalty points",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: id, user: req.user.userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const result = await redeemService({
      order,
      customerId: req.user.userId,
      points: req.body?.points,
    });

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Redeemed ${result.pointsUsed} points for ₱${result.discount} off`,
      data: {
        pointsUsed: result.pointsUsed,
        discount: result.discount,
        balance: result.balance,
        order: result.order,
      },
    });
  } catch (err) {
    console.error("Redeem points error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
