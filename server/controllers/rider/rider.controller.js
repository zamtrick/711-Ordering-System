import mongoose from "mongoose";
import Rider from "../../models/Rider.js";
import Order from "../../models/Order.js";
import AuditLog from "../../models/AuditLog.js";
import { notifyDeliveryAssigned, notifyDeliveryCompleted } from "../../services/email.service.js";
import { emitOrderUpdated } from "../../socket.js";

/* -------------------------------------------------------------------------- */
/* GET RIDER PROFILE                                                          */
/* -------------------------------------------------------------------------- */

export const getProfile = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.userId })
      .populate("user", "-password")
      .populate("assignedBranch");

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: rider,
    });
  } catch (err) {
    console.error("Get rider profile error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* -------------------------------------------------------------------------- */
/* UPDATE RIDER PROFILE                                                       */
/* -------------------------------------------------------------------------- */

export const updateProfile = async (req, res) => {
  try {
    const { phone, address, vehicleType, vehiclePlateNumber } = req.body;

    const rider = await Rider.findOne({ user: req.user.userId });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    if (phone !== undefined) rider.phone = phone.trim();
    if (address !== undefined) rider.address = address.trim();
    if (vehicleType !== undefined) rider.vehicleType = vehicleType.trim();

    if (vehiclePlateNumber !== undefined) {
      const normalizedPlate = vehiclePlateNumber.trim().toUpperCase();
      const existing = await Rider.findOne({
        vehiclePlateNumber: normalizedPlate,
        _id: { $ne: rider._id },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Vehicle plate number is already registered",
        });
      }
      rider.vehiclePlateNumber = normalizedPlate;
    }

    await rider.save();

    const updated = await Rider.findById(rider._id)
      .populate("user", "-password")
      .populate("assignedBranch");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Update rider profile error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* -------------------------------------------------------------------------- */
/* CHANGE AVAILABILITY STATUS                                                 */
/* -------------------------------------------------------------------------- */

export const updateAvailability = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["available", "offline"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'available' or 'offline'",
      });
    }

    const rider = await Rider.findOne({ user: req.user.userId });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    // Can't go offline while delivering
    if (status === "offline" && rider.availabilityStatus === "delivering") {
      return res.status(400).json({
        success: false,
        message: "Cannot go offline while delivering an order",
      });
    }

    rider.availabilityStatus = status;
    await rider.save();

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      data: { availabilityStatus: rider.availabilityStatus },
    });
  } catch (err) {
    console.error("Update availability error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* -------------------------------------------------------------------------- */
/* GET AVAILABLE DELIVERIES (unassigned orders pending/processing)             */
/* -------------------------------------------------------------------------- */

export const getAvailableDeliveries = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.userId });

    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const orders = await Order.find({
      deliveryStatus: "unassigned",
      status: { $in: ["pending", "processing"] },
      branch: rider.assignedBranch,
    })
      .populate("user", "firstname lastname email")
      .populate("branch", "name branchCode location")
      .populate({
        path: "orderItems",
        populate: { path: "product", select: "name price image" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      deliveries: orders,
    });
  } catch (err) {
    console.error("Get available deliveries error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* -------------------------------------------------------------------------- */
/* GET MY DELIVERIES (assigned to this rider)                                 */
/* -------------------------------------------------------------------------- */

export const getMyDeliveries = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.userId });

    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const orders = await Order.find({
      rider: rider._id,
      deliveryStatus: { $in: ["assigned", "picked_up", "in_transit"] },
    })
      .populate("user", "firstname lastname email")
      .populate("branch", "name branchCode location address")
      .populate({
        path: "orderItems",
        populate: { path: "product", select: "name price image" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      deliveries: orders,
    });
  } catch (err) {
    console.error("Get my deliveries error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* -------------------------------------------------------------------------- */
/* GET DELIVERY HISTORY (completed/cancelled)                                  */
/* -------------------------------------------------------------------------- */

export const getDeliveryHistory = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.userId });

    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const orders = await Order.find({
      rider: rider._id,
      deliveryStatus: "delivered",
    })
      .populate("user", "firstname lastname email")
      .populate("branch", "name branchCode")
      .populate({
        path: "orderItems",
        populate: { path: "product", select: "name price" },
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      deliveries: orders,
    });
  } catch (err) {
    console.error("Get delivery history error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* -------------------------------------------------------------------------- */
/* ACCEPT DELIVERY                                                            */
/* -------------------------------------------------------------------------- */

export const acceptDelivery = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const rider = await Rider.findOne({ user: req.user.userId });

    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    if (rider.availabilityStatus === "offline") {
      return res.status(400).json({
        success: false,
        message: "You must be available to accept deliveries",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryStatus !== "unassigned") {
      return res.status(400).json({
        success: false,
        message: "This delivery is no longer available",
      });
    }

    order.rider = rider._id;
    order.deliveryStatus = "assigned";
    order.status = "processing";
    await order.save();

    rider.availabilityStatus = "delivering";
    await rider.save();

    // Audit log
    await AuditLog.create({
      user: req.user.userId,
      action: "accepted_delivery",
      target: "Order",
      targetId: order._id,
      details: `Rider accepted delivery for order #${order._id.toString().slice(-6).toUpperCase()}`,
    });

    const updated = await Order.findById(order._id)
      .populate("user", "firstname lastname email")
      .populate("branch", "name branchCode location address")
      .populate({
        path: "orderItems",
        populate: { path: "product", select: "name price image" },
      });

    /* Email notification to rider (non-blocking) */
    const riderUser = await (await import("../../models/User.js")).default.findById(rider.user);
    if (riderUser?.email) {
      notifyDeliveryAssigned({
        _id: rider._id,
        name: `${riderUser.firstname} ${riderUser.lastname}`,
        email: riderUser.email,
        order: {
          orderId: order._id.toString(),
          customerName: updated.user ? `${updated.user.firstname} ${updated.user.lastname}` : "Customer",
          branchName: updated.branch?.name || "Unknown",
          branchAddress: updated.branch?.address?.street || updated.branch?.location || "",
          totalAmount: updated.totalAmount,
        },
      }).catch(() => {});
    }

    emitOrderUpdated(updated);

    return res.status(200).json({
      success: true,
      message: "Delivery accepted",
      data: updated,
    });
  } catch (err) {
    console.error("Accept delivery error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* -------------------------------------------------------------------------- */
/* UPDATE DELIVERY STATUS                                                     */
/* -------------------------------------------------------------------------- */

export const updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryStatus } = req.body;

    const validTransitions = {
      assigned: ["picked_up"],
      picked_up: ["in_transit"],
      in_transit: ["delivered"],
    };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const rider = await Rider.findOne({ user: req.user.userId });

    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.rider?.toString() !== rider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "This delivery is not assigned to you",
      });
    }

    const allowed = validTransitions[order.deliveryStatus] || [];
    if (!allowed.includes(deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${order.deliveryStatus}' to '${deliveryStatus}'`,
      });
    }

    order.deliveryStatus = deliveryStatus;

    if (deliveryStatus === "delivered") {
      order.status = "completed";
      rider.availabilityStatus = "available";
    }

    await order.save();
    await rider.save();

    // Audit log
    await AuditLog.create({
      user: req.user.userId,
      action: `delivery_${deliveryStatus}`,
      target: "Order",
      targetId: order._id,
      details: `Rider updated delivery status to ${deliveryStatus} for order #${order._id.toString().slice(-6).toUpperCase()}`,
    });

    const updated = await Order.findById(order._id)
      .populate("user", "firstname lastname email")
      .populate("branch", "name branchCode location address")
      .populate({
        path: "orderItems",
        populate: { path: "product", select: "name price image" },
      });

    /* Email notification on delivery completed (non-blocking) */
    if (deliveryStatus === "delivered" && updated?.user?.email) {
      notifyDeliveryCompleted({
        _id: updated._id,
        customerName: `${updated.user.firstname} ${updated.user.lastname}`,
        customerEmail: updated.user.email,
        totalAmount: updated.totalAmount,
      }).catch(() => {});
    }

    emitOrderUpdated(updated);

    return res.status(200).json({
      success: true,
      message: `Delivery status updated to ${deliveryStatus}`,
      data: updated,
    });
  } catch (err) {
    console.error("Update delivery status error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* -------------------------------------------------------------------------- */
/* GET RIDER STATS                                                            */
/* -------------------------------------------------------------------------- */

export const getStats = async (req, res) => {
  try {
    const rider = await Rider.findOne({ user: req.user.userId });

    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const [activeDeliveries, completedDeliveries, totalEarnings] = await Promise.all([
      Order.countDocuments({
        rider: rider._id,
        deliveryStatus: { $in: ["assigned", "picked_up", "in_transit"] },
      }),
      Order.countDocuments({
        rider: rider._id,
        deliveryStatus: "delivered",
      }),
      Order.aggregate([
        {
          $match: {
            rider: rider._id,
            deliveryStatus: "delivered",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activeDeliveries,
        completedDeliveries,
        totalEarnings: totalEarnings[0]?.total || 0,
        availabilityStatus: rider.availabilityStatus,
      },
    });
  } catch (err) {
    console.error("Get rider stats error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
