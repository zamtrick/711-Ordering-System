import mongoose from "mongoose";

import Order from "../../models/Order.js";
import OrderItem from "../../models/OrderItem.js";
import Product from "../../models/Product.js";
import Branch from "../../models/Branch.js";
import User from "../../models/User.js";
import Customer from "../../models/Customer.js";
import Payment from "../../models/Payment.js";
import Rider from "../../models/Rider.js";
import { refreshRiderAvailability } from "../../utils/riderLoad.js";
import { getCurrentDeliveryFee, getEffectiveDeliveryRange, haversineKm } from "../settings.controller.js";
import { notifyOrderPlaced, notifyOrderStatusChanged } from "../../services/email.service.js";
import { emitOrderUpdated } from "../../socket.js";
import { canAccessBranchDoc } from "../../middlewares/branchScope.middleware.js";

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

/*
|--------------------------------------------------------------------------
| PAYMENT METHOD LABELS
|--------------------------------------------------------------------------
| Human-readable names for confirmation emails and order summaries.
|--------------------------------------------------------------------------
*/

const PAYMENT_LABELS = {
  cash: "Cash on Delivery",
  card: "Card",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

export const createOrder = async (req, res) => {
  try {
    // Get the authenticated user's ID from the JWT
    const user = req.user.userId;

    const {
      branch,
      deliveryAddress: clientDeliveryAddress,
      deliveryLat,
      deliveryLng,
    } = req.body;

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
    | CHECK EMAIL VERIFICATION
    |--------------------------------------------------------------------------
    | Browse-before-buy: unverified accounts can shop, but only verified
    | emails may place orders. The app routes these users to OTP first —
    | this is the server-side backstop if the client is bypassed.
    |--------------------------------------------------------------------------
    */

    const orderUser = await User.findById(user).select("isVerified");
    if (orderUser && !orderUser.isVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before placing an order.",
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
    | VALIDATE PAYMENT METHOD
    |--------------------------------------------------------------------------
    | The method must be one the branch actually accepts. A temporary Payment
    | record (status: pending) is created and linked to the order so admins
    | know how the customer intends to pay. For COD-style methods it flips to
    | "paid" when the rider completes delivery; cancellations/refunds mark it
    | accordingly. Nothing is charged here — no gateway integration yet.
    |--------------------------------------------------------------------------
    */

    const { paymentMethod } = req.body;

    const acceptedMethods = branchData.paymentMethods ?? ["cash"];
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }
    if (!acceptedMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `This branch does not accept ${PAYMENT_LABELS[paymentMethod] ?? paymentMethod}. Accepted: ${acceptedMethods
          .map((m) => PAYMENT_LABELS[m] ?? m)
          .join(", ")}`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | GET CUSTOMER'S DEFAULT ADDRESS
    |--------------------------------------------------------------------------
    */

    const customer = await Customer.findOne({ user });
    let deliveryAddress = "";

    // Prefer the address explicitly chosen by the customer during checkout.
    // Fall back to their saved default address if none was provided.
    if (clientDeliveryAddress && typeof clientDeliveryAddress === "string" && clientDeliveryAddress.trim()) {
      deliveryAddress = clientDeliveryAddress.trim();
    } else if (customer && customer.addresses.length > 0) {
      const defaultAddr = customer.addresses.find((a) => a.isDefault);
      deliveryAddress = defaultAddr ? defaultAddr.address : customer.addresses[0].address;
    }

    /*
    |--------------------------------------------------------------------------
    | DELIVERY RANGE CHECK
    |--------------------------------------------------------------------------
    | The checkout map picker gives us the exact pin coordinates. When they're
    | present we validate the straight-line distance against the branch's
    | effective delivery range (branch override > superadmin default).
    | Addresses typed manually without a pin skip this check — the branch can
    | still refuse/redirect the order manually.
    */

    const parsedLat = Number(deliveryLat);
    const parsedLng = Number(deliveryLng);
    const hasCoords =
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      parsedLat >= -90 && parsedLat <= 90 &&
      parsedLng >= -180 && parsedLng <= 180;

    if (hasCoords) {
      const branchLat = branchData.coordinates?.lat;
      const branchLng = branchData.coordinates?.lng;

      if (branchLat == null || branchLng == null) {
        return res.status(400).json({
          success: false,
          message: "This branch hasn't set its map location yet — please contact the branch or choose another one.",
        });
      }

      const effectiveRangeKm = await getEffectiveDeliveryRange(branchData);
      const distanceKm = haversineKm(branchLat, branchLng, parsedLat, parsedLng);

      if (distanceKm > effectiveRangeKm) {
        return res.status(400).json({
          success: false,
          message: `Your address is ${distanceKm.toFixed(1)} km from ${branchData.name} — outside its ${effectiveRangeKm} km delivery range. Please pick a closer branch or a different address.`,
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE ORDER
    |--------------------------------------------------------------------------
    */

    // Snapshot the current delivery fee — the order keeps the fee that was
    // in effect when it was placed, even if the admin changes it later.
    const deliveryFee = await getCurrentDeliveryFee();

    const order = await Order.create({
      user,
      branch,
      orderItems: [],
      payment: null,
      deliveryFee,
      totalAmount: deliveryFee, // starts at the fee; items add on top
      status: "pending",
      deliveryAddress,
    });

    // Record how the customer intends to pay. Created after the order so it
    // can reference it; if this fails we roll the order back — an order
    // without a payment method is an invalid checkout in this system.
    let payment = null;
    try {
      payment = await Payment.create({
        order: order._id,
        paymentReference: `PAY-${order._id.toString().slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        amount: deliveryFee, // grows via order totals below
        paymentMethod,
        status: "pending",
      });
      order.payment = payment._id;
      await order.save();
    } catch (paymentError) {
      await Order.findByIdAndDelete(order._id);
      throw paymentError;
    }

    /*
    |--------------------------------------------------------------------------
    | RETURN CREATED ORDER
    |--------------------------------------------------------------------------
    */

    const createdOrder = await Order.findById(order._id)
      .populate("user", "firstname lastname email")
      .populate("branch")
      .populate("payment")
      .populate({
        path: "rider",
        select: "phone vehicleType vehiclePlateNumber",
        populate: { path: "user", select: "firstname lastname" },
      });

    /* Email notification (non-blocking) */
    if (createdOrder?.user?.email) {
      notifyOrderPlaced({
        _id: createdOrder._id,
        customerName: `${createdOrder.user.firstname} ${createdOrder.user.lastname}`,
        customerEmail: createdOrder.user.email,
        branchName: createdOrder.branch?.name || "Unknown",
        totalAmount: createdOrder.totalAmount,
      }).catch(() => {});
    }

    // Push to admins live (admin_room) + back to the customer
    emitOrderUpdated(createdOrder);

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

    // Customers may only view their own orders.
    // Branch admins see only their branch's orders; superadmins see all.
    const orderQuery =
      req.user.role === "admin"
        ? { branch: req.adminBranchId }
        : req.user.role === "superadmin"
          ? {}
          : { user: userId };

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
    if (req.user.role === "admin") {
      orderQuery.branch = req.adminBranchId;
    } else if (req.user.role !== "superadmin") {
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
      .populate("payment")
      .populate({
        path: "rider",
        select: "phone vehicleType vehiclePlateNumber",
        populate: { path: "user", select: "firstname lastname" },
      });

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
    if (req.user.role === "admin") {
      orderQuery.branch = req.adminBranchId;
    } else if (req.user.role !== "superadmin") {
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

    // Release the rider — otherwise a cancelled order strands its delivery
    // in assigned/picked_up/in_transit: it keeps showing in the rider's
    // active list and the rider stays "delivering" forever.
    const releasedRiderId = order.rider ? order.rider.toString() : null;
    order.rider = null;
    order.deliveryStatus = "unassigned";

    await order.save();

    // Restore reserved stock for the cancelled order's items
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
      // stock restore must not break the cancel path
    }

    // Keep the linked payment in sync — nothing was charged, so it dies too.
    if (order.payment) {
      await Payment.findByIdAndUpdate(order.payment, { status: "cancelled" });
    }

    // Recount the freed rider (back to "available" if nothing else active).
    if (releasedRiderId) {
      const freedRider = await Rider.findById(releasedRiderId);
      await refreshRiderAvailability(freedRider);
    }

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
      .populate("payment")
      .populate({
        path: "rider",
        select: "phone vehicleType vehiclePlateNumber",
        populate: { path: "user", select: "firstname lastname" },
      });

    /* Email notification (non-blocking) */
    if (cancelledOrder?.user?.email) {
      notifyOrderStatusChanged({
        _id: cancelledOrder._id,
        customerName: `${cancelledOrder.user.firstname} ${cancelledOrder.user.lastname}`,
        customerEmail: cancelledOrder.user.email,
        status: "cancelled",
        totalAmount: cancelledOrder.totalAmount,
      }).catch(() => {});
    }

    emitOrderUpdated(cancelledOrder);

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
