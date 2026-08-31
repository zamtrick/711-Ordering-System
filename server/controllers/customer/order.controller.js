import mongoose from "mongoose";

import Order from "../../models/Order.js";
import Branch from "../../models/Branch.js";

/*
|--------------------------------------------------------------------------
| CREATE ORDER
|--------------------------------------------------------------------------
| Creates a new order for the currently logged-in customer.
|
| The customer ID comes from the JWT:
| req.user.userId
|
| Request body:
| {
|   "branch": "BRANCH_ID"
| }
|
| A newly created order starts with:
| - orderItems: []
| - payment: null
| - totalAmount: 0
| - status: "pending"
|--------------------------------------------------------------------------
*/

export const createOrder = async (req, res) => {
  try {
    // Get the authenticated user's ID from the JWT
    const user = req.user.userId;

    const { branch } = req.body;

    /*
    |--------------------------------------------------------------------------
    | CHECK AUTHENTICATION
    |--------------------------------------------------------------------------
    */

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK BRANCH
    |--------------------------------------------------------------------------
    */

    if (!branch) {
      return res.status(400).json({
        success: false,
        message: "Branch is required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE BRANCH ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(branch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND BRANCH
    |--------------------------------------------------------------------------
    */

    const branchData = await Branch.findById(branch);

    if (!branchData) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK BRANCH STATUS
    |--------------------------------------------------------------------------
    | Only active branches should accept new orders.
    |--------------------------------------------------------------------------
    */

    if (branchData.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "This branch is currently unavailable",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE ORDER
    |--------------------------------------------------------------------------
    */

    const order = await Order.create({
      user,
      branch,
      orderItems: [],
      payment: null,
      totalAmount: 0,
      status: "pending",
    });

    /*
    |--------------------------------------------------------------------------
    | RETURN CREATED ORDER
    |--------------------------------------------------------------------------
    */

    const createdOrder = await Order.findById(order._id)
      .populate("user", "firstname lastname email")
      .populate("branch");

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: createdOrder,
    });
  } catch (err) {
    console.error("Create order error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET CUSTOMER ORDERS
|--------------------------------------------------------------------------
| Retrieves only the orders belonging to the currently logged-in customer.
|
| The customer cannot see another customer's orders.
|--------------------------------------------------------------------------
*/

export const getOrders = async (req, res) => {
  try {
    // Get logged-in customer ID from JWT
    const userId = req.user.userId;

    // Customers may only view their own orders. Admins are allowed by the
    // route middleware and can view all orders.
    const orderQuery = req.user.role === "admin" ? {} : { user: userId };

    /*
    |--------------------------------------------------------------------------
    | FIND CUSTOMER ORDERS
    |--------------------------------------------------------------------------
    */

    const orders = await Order.find(orderQuery)
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate({
        path: "orderItems",
        populate: {
          path: "product",
        },
      })
      .populate("payment")
      .sort({ createdAt: -1 });

    /*
    |--------------------------------------------------------------------------
    | CHECK IF CUSTOMER HAS ORDERS
    |--------------------------------------------------------------------------
    */

    /*
    |--------------------------------------------------------------------------
    | RETURN ORDERS
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      orders,
    });
  } catch (err) {
    console.error("Get customer orders error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET CUSTOMER ORDER BY ID
|--------------------------------------------------------------------------
| Retrieves one order belonging to the currently logged-in customer.
|
| The order must belong to req.user.userId.
|--------------------------------------------------------------------------
*/

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE ORDER ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND ORDER
    |--------------------------------------------------------------------------
    | We include the customer ID in the query.
    | This prevents Customer A from accessing Customer B's order.
    |--------------------------------------------------------------------------
    */

    const orderQuery = { _id: id };
    if (req.user.role !== "admin") {
      orderQuery.user = userId;
    }

    const order = await Order.findOne(orderQuery)
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate({
        path: "orderItems",
        populate: {
          path: "product",
        },
      })
      .populate("payment");

    /*
    |--------------------------------------------------------------------------
    | CHECK ORDER
    |--------------------------------------------------------------------------
    */

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | RETURN ORDER
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      message: "Order found",
      data: order,
    });
  } catch (err) {
    console.error("Get customer order error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| CANCEL ORDER
|--------------------------------------------------------------------------
| Allows the customer to cancel their own order.
|
| Customer can cancel while the order is:
| - pending
| - processing
|
| Customer cannot cancel:
| - completed
| - cancelled
| - refunded
|--------------------------------------------------------------------------
*/

export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE ORDER ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND CUSTOMER'S ORDER
    |--------------------------------------------------------------------------
    | The user ID is included so customers can only cancel
    | their own orders.
    |--------------------------------------------------------------------------
    */

    const orderQuery = { _id: id };
    if (req.user.role !== "admin") {
      orderQuery.user = userId;
    }

    const order = await Order.findOne(orderQuery);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK ORDER STATUS
    |--------------------------------------------------------------------------
    */

    if (order.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed orders cannot be cancelled",
      });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    if (order.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Refunded orders cannot be cancelled",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CANCEL ORDER
    |--------------------------------------------------------------------------
    */

    order.status = "cancelled";

    await order.save();

    /*
    |--------------------------------------------------------------------------
    | RETURN CANCELLED ORDER
    |--------------------------------------------------------------------------
    */

    const cancelledOrder = await Order.findById(order._id)
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate({
        path: "orderItems",
        populate: {
          path: "product",
        },
      })
      .populate("payment");

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: cancelledOrder,
    });
  } catch (err) {
    console.error("Cancel order error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
