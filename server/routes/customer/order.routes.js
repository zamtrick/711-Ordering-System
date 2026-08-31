import express from "express";

import {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
} from "../../controllers/customer/order.controller.js";

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

export default router;
