import mongoose from "mongoose";

import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import AuditLog from "../../models/AuditLog.js";
import { notifyOrderStatusChanged } from "../../services/email.service.js";
import { emitOrderUpdated } from "../../socket.js";
import {
  branchQuery,
  canAccessBranchDoc,
} from "../../middlewares/branchScope.middleware.js";

/*
|--------------------------------------------------------------------------
| ADMIN ORDER STATUS TRANSITIONS
|--------------------------------------------------------------------------
| pending    -> processing, cancelled
| processing -> completed, cancelled, refunded
| completed  -> refunded
| cancelled / refunded -> terminal
|--------------------------------------------------------------------------
*/

const ALLOWED_TRANSITIONS = {
  pending: ["processing", "cancelled"],
  processing: ["completed", "cancelled", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

/*
|--------------------------------------------------------------------------
| GET ADMIN ORDERS
|--------------------------------------------------------------------------
| Branch-scoped listing: regular admins only see orders for their assigned
| branch; superadmins see everything, newest first.
|--------------------------------------------------------------------------
*/

export const getAdminOrders = async (req, res) => {
  try {
    const orders = await Order.find(branchQuery(req, "branch"))
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate({
        path: "orderItems",
        populate: { path: "product" },
      })
      .populate("payment")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      orders,
    });
  } catch (err) {
    console.error("Get admin orders error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE ORDER STATUS (ADMIN)
|--------------------------------------------------------------------------
| PATCH /api/admin/orders/:id/status
| Body: { "status": "processing" | "completed" | "cancelled" | "refunded" }
|--------------------------------------------------------------------------
*/

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const validStatuses = ["processing", "completed", "cancelled", "refunded"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const order = await Order.findById(id);
    if (!order || !canAccessBranchDoc(req, order.branch)) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${order.status}' to '${status}'`,
      });
    }

    // Refunds are superadmin-only (audited). Admins get 403.
    if (status === "refunded" && req.user?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only superadmin can refund orders.",
      });
    }

    // Completed is only allowed after the rider marks delivery as delivered.
    // Rider delivery already auto-completes (rider.controller), this guards
    // manual admin completion from racing the rider.
    if (status === "completed" && order.deliveryStatus !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Cannot complete order before rider marks it as delivered.",
      });
    }

    order.status = status;
    await order.save();

    // Keep the linked payment in sync with the order lifecycle:
    // cancelled → nothing was charged; refunded → money went back.
    if (order.payment && (status === "cancelled" || status === "refunded")) {
      await Payment.findByIdAndUpdate(order.payment, { status });
    }

    try {
      await AuditLog.create({
        user: req.user.userId,
        action: `order_${status}`,
        target: "Order",
        targetId: order._id,
        details: `Admin updated order #${order._id.toString().slice(-6).toUpperCase()} to ${status}`,
      });
    } catch {
      // audit failures must not break the request
    }

    const updated = await Order.findById(order._id)
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate({
        path: "orderItems",
        populate: { path: "product" },
      })
      .populate("payment");

    // Push live to the customer + other admins
    emitOrderUpdated(updated);

    // Notify the customer (non-blocking, log-only unless SMTP is set)
    if (updated?.user?.email) {
      notifyOrderStatusChanged({
        _id: updated._id,
        customerName: `${updated.user.firstname} ${updated.user.lastname}`,
        customerEmail: updated.user.email,
        status,
        totalAmount: updated.totalAmount,
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: `Order updated to ${status}`,
      data: updated,
    });
  } catch (err) {
    console.error("Admin update order status error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
