import express from "express";

import {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
} from "../../controllers/customer/order.controller.js";
import { redeemOrderPoints } from "../../controllers/customer/loyalty.controller.js";
import {
  applyPromoCode,
  removePromoCode,
} from "../../controllers/customer/promoCode.controller.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| ORDER ROUTES
|--------------------------------------------------------------------------
*/

// Create a new order
// POST /api/customer/orders
router.post("/", createOrder);

// Get all orders belonging to the logged-in customer
// GET /api/customer/orders
router.get("/", getOrders);

// Get one specific order
// GET /api/customer/orders/:id
router.get("/:id", getOrderById);

// Cancel customer's own order
// PATCH /api/customer/orders/:id/cancel
router.patch("/:id/cancel", cancelOrder);

// Redeem loyalty points against a pending order
// POST /api/orders/:id/redeem  (body: { points })
router.post("/:id/redeem", redeemOrderPoints);

// Apply / remove a promo code on a pending order
// POST   /api/orders/:id/promo  (body: { code })
// DELETE /api/orders/:id/promo
router.post("/:id/promo", applyPromoCode);
router.delete("/:id/promo", removePromoCode);

export default router;
