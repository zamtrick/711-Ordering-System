import mongoose from "mongoose";

import Order from "../../models/Order.js";
import OrderItem from "../../models/OrderItem.js";
import Product from "../../models/Product.js";
import Payment from "../../models/Payment.js";
import AuditLog from "../../models/AuditLog.js";
import { notifyOrderStatusChanged } from "../../services/email.service.js";
import { emitOrderUpdated } from "../../socket.js";
import {
  branchQuery,
  canAccessBranchDoc,
} from "../../middlewares/branchScope.middleware.js";
import {
  parsePagination,
  buildPaginationMeta,
  escapeRegex,
} from "../../utils/pagination.js";
import User from "../../models/User.js";
import Rider from "../../models/Rider.js";
import {
  countActiveDeliveries,
  getMaxActiveDeliveries,
  refreshRiderAvailability,
} from "../../utils/riderLoad.js";

/*
|--------------------------------------------------------------------------
| ADMIN ORDER STATUS TRANSITIONS
|--------------------------------------------------------------------------
| Admins and superadmins can NOT cancel orders — cancellation is the
| customer's own right (PATCH /api/customer/orders/:id/cancel). The admin
| path only moves orders forward or refunds them.
|
| pending    -> processing
| processing -> completed, refunded
| completed  -> refunded
| cancelled / refunded -> terminal
|--------------------------------------------------------------------------
*/

const ALLOWED_TRANSITIONS = {
  pending: ["processing"],
  processing: ["completed", "refunded"],
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
    const { page, limit, skip, search, status, paginated } = parsePagination(req);

    const baseQuery = branchQuery(req, "branch");

    // Server-side search by customer name or order ID.
    let query = baseQuery;
    if (search) {
      if (mongoose.Types.ObjectId.isValid(search)) {
        query = { ...baseQuery, _id: search };
      } else {
        const searchRegex = new RegExp(escapeRegex(search), "i");
        const users = await User.find({
          $or: [{ firstname: searchRegex }, { lastname: searchRegex }],
        })
          .select("_id")
          .lean();
        query = { ...baseQuery, user: { $in: users.map((u) => u._id) } };
      }
    }

    // Optional status filter (?status=pending|processing|completed|cancelled|refunded)
    if (status) {
      const allowed = ["pending", "processing", "completed", "cancelled", "refunded"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status filter" });
      }
      query = { ...query, status };
    }

    const total = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate({
        path: "orderItems",
        populate: { path: "product" },
      })
      .populate("payment")
      .populate({
        path: "rider",
        select: "phone vehicleType vehiclePlateNumber",
        populate: { path: "user", select: "firstname lastname" },
      })
      .sort({ createdAt: -1 })
      .skip(paginated ? skip : 0)
      .limit(paginated ? limit : 0);

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      orders,
      ...(paginated ? { pagination: buildPaginationMeta(total, page, limit) } : {}),
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

    // Cancelling is a customer right, not an admin one — reject it loudly
    // (before the transition check) so the message is unambiguous.
    if (status === "cancelled") {
      return res.status(403).json({
        success: false,
        message: "Admins cannot cancel orders — only the customer can cancel their own order.",
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

    // Cancelling/refunding must also release the rider — same stranding bug
    // as customer cancel (delivery stuck in assigned/picked_up/in_transit,
    // rider stuck "delivering").
    let releasedRiderId = null;
    if ((status === "cancelled" || status === "refunded") && order.rider) {
      releasedRiderId = order.rider.toString();
      order.rider = null;
      order.deliveryStatus = "unassigned";
    }
    await order.save();

    if (releasedRiderId) {
      const freedRider = await Rider.findById(releasedRiderId);
      await refreshRiderAvailability(freedRider);
    }

    // Keep the linked payment in sync with the order lifecycle:
    // cancelled → nothing was charged; refunded → money went back.
    if (order.payment && (status === "cancelled" || status === "refunded")) {
      await Payment.findByIdAndUpdate(order.payment, { status });
    }

    // Restore reserved stock when the order leaves the sellable pool
    if (status === "cancelled" || status === "refunded") {
      try {
        const items = await OrderItem.find({ order: order._id }).select(
          "product quantity",
        );
        for (const it of items) {
          if (it.product && it.quantity) {
            await Product.findByIdAndUpdate(it.product, {
              $inc: { stock: it.quantity },
            });
          }
        }
      } catch {
        // stock restore must not break the status path
      }
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
      .populate("payment")
      .populate({
        path: "rider",
        select: "phone vehicleType vehiclePlateNumber",
        populate: { path: "user", select: "firstname lastname" },
      });

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

/*
|--------------------------------------------------------------------------
| ASSIGN / REASSIGN / UNASSIGN RIDER (ADMIN)
|--------------------------------------------------------------------------
| PATCH /api/admin/orders/:id/rider
| Body: { "riderId": "<RiderId>" | null }
|
| - riderId set   -> manually assign (or reassign) that rider. Works when the
|   order is pending/processing and delivery is unassigned/assigned. Assigning
|   a pending order also moves it to processing (same as rider self-accept).
| - riderId null  -> unassign back to the pool ("unassigned").
| - Blocked once the rider picked up / is in transit / delivered (too late),
|   and on terminal orders (completed/cancelled/refunded).
| - The rider must belong to the order's branch. Capacity cap is a warning
|   here (not a block): small branches with 1-2 riders sometimes MUST overload
|   one rider, so admin can force-assign past the cap deliberately.
|--------------------------------------------------------------------------
*/

export const assignOrderRider = async (req, res) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }
    if (
      riderId !== null &&
      riderId !== undefined &&
      !mongoose.Types.ObjectId.isValid(riderId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid rider ID" });
    }

    const order = await Order.findById(id);
    if (!order || !canAccessBranchDoc(req, order.branch)) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (["completed", "cancelled", "refunded"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change rider on a ${order.status} order.`,
      });
    }
    if (["picked_up", "in_transit", "delivered"].includes(order.deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: `Too late to change rider (delivery is ${order.deliveryStatus}).`,
      });
    }

    const oldRiderId = order.rider?.toString() ?? null;
    let capacityWarning = null;

    if (riderId) {
      const rider = await Rider.findById(riderId).populate("user", "isActive");
      if (!rider || !canAccessBranchDoc(req, rider.assignedBranch)) {
        return res.status(404).json({ success: false, message: "Rider not found" });
      }
      if (rider.assignedBranch?.toString() !== order.branch?.toString()) {
        return res.status(400).json({
          success: false,
          message: "Rider belongs to a different branch.",
        });
      }
      if (rider.user?.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "That rider account is deactivated.",
        });
      }

      // Capacity is advisory for admins (they may need to overload the only
      // rider), but surface it so the overload is deliberate, not accidental.
      const alreadyCarrying = oldRiderId === rider._id.toString();
      const active = await countActiveDeliveries(rider._id);
      const liveCap = await getMaxActiveDeliveries();
      const effective = alreadyCarrying ? active - 1 : active;
      if (effective >= liveCap) {
        capacityWarning =
          `Rider already carries ${active}/${liveCap} active deliveries ` +
          `(cap ${liveCap}) — assigned anyway.`;
      }

      order.rider = rider._id;
      order.deliveryStatus = "assigned";
      if (order.status === "pending") order.status = "processing";
      await order.save();

      const freshRider = await Rider.findById(rider._id);
      if (freshRider && freshRider.availabilityStatus !== "offline") {
        freshRider.availabilityStatus = "delivering";
        await freshRider.save();
      }
    } else {
      // Unassign back to the pool
      order.rider = null;
      order.deliveryStatus = "unassigned";
      await order.save();
    }

    // Recount the previous rider: no more active orders -> back to available.
    if (oldRiderId && oldRiderId !== (riderId ?? null)?.toString?.()) {
      const oldRider = await Rider.findById(oldRiderId);
      await refreshRiderAvailability(oldRider);
    }

    try {
      await AuditLog.create({
        user: req.user.userId,
        action: riderId ? "order_rider_assigned" : "order_rider_unassigned",
        target: "Order",
        targetId: order._id,
        details: riderId
          ? `Admin assigned rider ${riderId} to order #${order._id.toString().slice(-6).toUpperCase()}${capacityWarning ? " (over capacity)" : ""}`
          : `Admin unassigned rider from order #${order._id.toString().slice(-6).toUpperCase()} (back to pool)`,
      });
    } catch {
      // audit failures must not break the request
    }

    const updated = await Order.findById(order._id)
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate({ path: "orderItems", populate: { path: "product" } })
      .populate("payment")
      .populate({
        path: "rider",
        select: "phone vehicleType vehiclePlateNumber availabilityStatus assignedBranch",
        populate: { path: "user", select: "firstname lastname" },
      });

    emitOrderUpdated(updated);

    return res.status(200).json({
      success: true,
      message: riderId ? "Rider assigned" : "Rider unassigned (back to pool)",
      ...(capacityWarning ? { warning: capacityWarning } : {}),
      data: updated,
    });
  } catch (err) {
    console.error("Admin assign rider error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
