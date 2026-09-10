import express from "express";

import {
  getAdminOrders,
  updateOrderStatus,
} from "../../controllers/admin/order.controller.js";

const router = express.Router();

// List all orders (admin / superadmin)
router.get("/", getAdminOrders);

// Transition an order: processing | completed | cancelled | refunded
router.patch("/:id/status", updateOrderStatus);

export default router;
