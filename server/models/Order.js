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
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
