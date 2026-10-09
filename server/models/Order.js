import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // User/customer who placed the order
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Branch where the order was made
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    // Products included in this order
    orderItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OrderItem",
      },
    ],

    // Payment associated with this order
    // Optional during initial order creation
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    // Assigned rider for delivery
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },

    // Rider delivery status
    deliveryStatus: {
      type: String,
      enum: ["unassigned", "assigned", "picked_up", "in_transit", "delivered"],
      default: "unassigned",
    },

    // Delivery fee in effect when the order was placed.
    // Snapshotted at creation so later fee changes don't alter old orders.
    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Current status of the order
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "cancelled", "refunded"],
      default: "pending",
    },

    // Total amount of the order
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Delivery address for this order
    deliveryAddress: {
      type: String,
      trim: true,
      default: "",
    },

    // Loyalty points earned when this order was completed. Also acts as the
    // idempotency marker so a delivered order is only ever awarded once.
    loyaltyPointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Loyalty points the customer applied to this order and the peso value
    // they knocked off totalAmount.
    loyaltyPointsRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },

    loyaltyDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Proof of delivery — captured when rider scans QR and completes delivery
    proofOfDelivery: {
      type: {
        photoUrl: { type: String, default: null },
        scannedAt: { type: Date, default: null },
        riderId: { type: mongoose.Schema.Types.ObjectId, ref: "Rider", default: null },
        qrToken: { type: String, default: null }, // The token that was scanned
      },
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
