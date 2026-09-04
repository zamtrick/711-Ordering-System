import mongoose from "mongoose";
import OrderItem from "../../models/OrderItem.js";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";

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

    const order = await Order.findById(orderId);

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

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    // Check order exists and belongs to this customer
    const order = await Order.findOne({
      _id: orderId,
      user: req.user.userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
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

    const unitPrice = product.price;
    const subTotal = unitPrice * quantity;

    // Create the order item
    const orderItem = await OrderItem.create({
      order: orderId,
      product: productId,
      quantity,
      unitPrice,
      subTotal,
    });

    // Add item reference to the order and update totalAmount
    order.orderItems.push(orderItem._id);
    order.totalAmount += subTotal;
    await order.save();

    const populated = await OrderItem.findById(orderItem._id).populate(
      "product",
    );

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const orderItem = await OrderItem.findOne({ _id: itemId, order: orderId });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    // Recalculate order totalAmount delta
    const order = await Order.findById(orderId);
    if (order) {
      order.totalAmount =
        order.totalAmount - orderItem.subTotal + orderItem.unitPrice * quantity;
      await order.save();
    }

    orderItem.quantity = quantity;
    orderItem.subTotal = orderItem.unitPrice * quantity;
    await orderItem.save();

    const updated = await OrderItem.findById(orderItem._id).populate("product");

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

    const orderItem = await OrderItem.findOne({ _id: itemId, order: orderId });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    // Subtract item subTotal from order totalAmount
    const order = await Order.findById(orderId);
    if (order) {
      order.orderItems = order.orderItems.filter(
        (id) => id.toString() !== itemId,
      );
      order.totalAmount = Math.max(0, order.totalAmount - orderItem.subTotal);
      await order.save();
    }

    await orderItem.deleteOne();

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
