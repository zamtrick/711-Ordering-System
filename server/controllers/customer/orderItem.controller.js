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
    // ADDED: Get orderId from URL parameter
    const { orderId } = req.params;

    // ADDED: Check if orderId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    // ADDED: Check if the order exists
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ADDED: Find all items belonging to this order
    const orderItems = await OrderItem.find({ order: orderId })
      .populate("productId")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    if (orderItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No order items found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "View all order items",
      orderItems,
    });
  } catch (err) {
    console.error(err.message);

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
    // ADDED: Get orderId from URL
    const { orderId } = req.params;

    // ADDED: Get data from request body
    const { user, productId, quantity } = req.body;

    // ADDED: Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    // ADDED: Validate required fields
    if (!user || !productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // ADDED: Validate quantity
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    // ADDED: Check if order exists
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ADDED: Check if product exists
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ADDED: Create order item
    const orderItem = await OrderItem.create({
      order: orderId,
      user,
      productId,
      quantity,
    });

    // ADDED: Add the new OrderItem ID to the Order
    order.orderItems.push(orderItem._id);

    // ADDED: Save the updated Order
    await order.save();

    // ADDED: Get the newly created item with populated data
    const populatedOrderItem = await OrderItem.findById(orderItem._id)
      .populate("productId")
      .populate("user", "name email");

    return res.status(201).json({
      success: true,
      message: "Order item created successfully",
      orderItem: populatedOrderItem,
    });
  } catch (err) {
    console.error(err.message);

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
    // ADDED: Get orderId and itemId from URL
    const { orderId, itemId } = req.params;

    // ADDED: Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID or Order Item ID",
      });
    }

    // ADDED: Find the item only if it belongs to this order
    const orderItem = await OrderItem.findOne({
      _id: itemId,
      order: orderId,
    })
      .populate("productId")
      .populate("user", "name email");

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "View order item successfully",
      orderItem,
    });
  } catch (err) {
    console.error(err.message);

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
    // ADDED: Get orderId and itemId from URL
    const { orderId, itemId } = req.params;

    // ADDED: Get updated data
    const { productId, quantity } = req.body;

    // ADDED: Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID or Order Item ID",
      });
    }

    // ADDED: Validate required fields
    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Product and quantity are required",
      });
    }

    // ADDED: Validate quantity
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    // ADDED: Check if order exists
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ADDED: Check if product exists
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ADDED: Find the item belonging to this order and update it
    const orderItem = await OrderItem.findOneAndUpdate(
      {
        _id: itemId,
        order: orderId,
      },
      {
        productId,
        quantity,
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("productId")
      .populate("user", "name email");

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order item updated successfully",
      orderItem,
    });
  } catch (err) {
    console.error(err.message);

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
    // ADDED: Get orderId and itemId from URL
    const { orderId, itemId } = req.params;

    // ADDED: Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID or Order Item ID",
      });
    }

    // ADDED: Delete only if the item belongs to this order
    const orderItem = await OrderItem.findOneAndDelete({
      _id: itemId,
      order: orderId,
    });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    // ADDED: Remove the deleted item ID from the Order
    await Order.findByIdAndUpdate(orderId, {
      $pull: {
        orderItems: itemId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Order item deleted successfully",
    });
  } catch (err) {
    console.error(err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
