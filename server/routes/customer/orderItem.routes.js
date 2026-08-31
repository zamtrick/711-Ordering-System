import express from "express";

import {
  getOrderItems,
  createOrderItem,
  getOrderItemById,
  updateOrderItemById,
  deleteOrderItemById,
} from "../../controllers/customer/orderItem.controller.js";

const router = express.Router();
/*
|--------------------------------------------------------------------------
| ORDER ITEM ROUTES
|--------------------------------------------------------------------------
*/

// Get all items belonging to an order
// GET /api/orders/:orderId/items
router.get("/:orderId/items", getOrderItems);

// Create a new item inside an existing order
// POST /api/orders/:orderId/items
router.post("/:orderId/items", createOrderItem);

// Get a specific item from an order
// GET /api/orders/:orderId/items/:itemId
router.get("/:orderId/items/:itemId", getOrderItemById);

// Update a specific item
// PATCH /api/orders/:orderId/items/:itemId
router.patch("/:orderId/items/:itemId", updateOrderItemById);

// Delete a specific item from an order
// DELETE /api/orders/:orderId/items/:itemId
router.delete("/:orderId/items/:itemId", deleteOrderItemById);

export default router;
