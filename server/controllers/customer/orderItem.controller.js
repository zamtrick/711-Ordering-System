import mongoose from "mongoose";
import OrderItem from "../../models/OrderItem.js";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import { emitOrderUpdated } from "../../socket.js";

// Emit the fully-populated order so admin/customer listeners stay in sync
// without an extra refetch.
const emitFullOrder = async (orderId) => {
  try {
    const full = await Order.findById(orderId)
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate({ path: "orderItems", populate: { path: "product" } })
      .populate("payment");
    if (full) emitOrderUpdated(full);
  } catch {
    // never break the request path on socket errors
  }
};

// ==========================================
// Helpers
// ==========================================

// Customers may only touch their own orders; admins can manage all.
const orderQueryFor = (req, orderId) => {
  const query = { _id: orderId };
  if (req.user.role !== "admin") query.user = req.user.userId;
  return query;
};

// ==========================================
// GET ALL ORDER ITEMS
// GET /api/orders/:orderId/items
// ==========================================
export const getOrderItems = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    const order = await Order.findOne(orderQueryFor(req, orderId));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderItems = await OrderItem.find({ order: orderId })
      .populate("product")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Order items retrieved",
      data: orderItems,
    });
  } catch (err) {
    console.error("Get order items error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ==========================================
// CREATE ORDER ITEM
// POST /api/orders/:orderId/items
// ==========================================
export const createOrderItem = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId, quantity } = req.body;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    // Validate required fields
    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "productId and quantity are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product ID",
      });
    }

    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a whole number of at least 1",
      });
    }

    // Check order exists and belongs to this customer
    const order = await Order.findOne(orderQueryFor(req, orderId));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Only pending orders accept new items
    if (order.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot add items to a ${order.status} order`,
      });
    }

    // Check product exists and is active
    const product = await Product.findById(productId);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Stock guard — never allow ordering more than available
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for "${product.name}". Only ${product.stock} left.`,
      });
    }

    const unitPrice = product.price;
    const subTotal = unitPrice * Number(quantity);

    // Create the order item
    const orderItem = await OrderItem.create({
      order: orderId,
      product: productId,
      quantity: Number(quantity),
      unitPrice,
      subTotal,
    });

    // Add item reference to the order and update totalAmount ATOMICALLY.
    // The mobile checkout fires one request per cart item in parallel
    // (Promise.all) — a read-modify-write here loses updates and corrupts
    // the total. $push/$inc are atomic on the server.
    await Order.findByIdAndUpdate(orderId, {
      $push: { orderItems: orderItem._id },
      $inc: { totalAmount: subTotal },
    });

    const populated = await OrderItem.findById(orderItem._id).populate(
      "product",
    );

    // Checkout adds items one-by-one — push each update live so the admin
    // Orders board and the customer's tracker stay current.
    emitFullOrder(orderId).catch(() => {});

    return res.status(201).json({
      success: true,
      message: "Order item added successfully",
      data: populated,
    });
  } catch (err) {
    console.error("Create order item error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ==========================================
// GET SPECIFIC ORDER ITEM
// GET /api/orders/:orderId/items/:itemId
// ==========================================
export const getOrderItemById = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID or Order Item ID",
      });
    }

    // Ownership check — customers can only read their own order's items
    const order = await Order.findOne(orderQueryFor(req, orderId));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderItem = await OrderItem.findOne({
      _id: itemId,
      order: orderId,
    }).populate("product");

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order item retrieved",
      data: orderItem,
    });
  } catch (err) {
    console.error("Get order item error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ==========================================
// UPDATE ORDER ITEM
// PATCH /api/orders/:orderId/items/:itemId
// ==========================================
export const updateOrderItemById = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { quantity } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID or Order Item ID",
      });
    }

    if (!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a whole number of at least 1",
      });
    }

    // Ownership check
    const order = await Order.findOne(orderQueryFor(req, orderId));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderItem = await OrderItem.findOne({ _id: itemId, order: orderId });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    // Stock guard for the new quantity
    const product = await Product.findById(orderItem.product);
    if (product && product.stock < Number(quantity)) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for "${product.name}". Only ${product.stock} left.`,
      });
    }

    // Atomic total adjustment: apply the delta, not a read-modify-write
    const delta = orderItem.unitPrice * Number(quantity) - orderItem.subTotal;

    orderItem.quantity = Number(quantity);
    orderItem.subTotal = orderItem.unitPrice * Number(quantity);
    await orderItem.save();

    if (delta !== 0) {
      await Order.findByIdAndUpdate(orderId, { $inc: { totalAmount: delta } });
    }

    const updated = await OrderItem.findById(orderItem._id).populate("product");

    emitFullOrder(orderId).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Order item updated",
      data: updated,
    });
  } catch (err) {
    console.error("Update order item error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ==========================================
// DELETE ORDER ITEM
// DELETE /api/orders/:orderId/items/:itemId
// ==========================================
export const deleteOrderItemById = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID or Order Item ID",
      });
    }

    // Ownership check
    const order = await Order.findOne(orderQueryFor(req, orderId));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderItem = await OrderItem.findOne({ _id: itemId, order: orderId });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    // Remove the reference and subtract the subtotal ATOMICALLY
    await Order.findByIdAndUpdate(orderId, {
      $pull: { orderItems: itemId },
      $inc: { totalAmount: -orderItem.subTotal },
    });

    await orderItem.deleteOne();

    emitFullOrder(orderId).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Order item removed",
    });
  } catch (err) {
    console.error("Delete order item error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
