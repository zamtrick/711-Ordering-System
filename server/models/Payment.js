import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // Order associated with this payment
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    // Unique reference number for the payment
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Amount paid by the customer
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Payment method used by the customer
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "gcash", "maya", "bank_transfer", "other"],
      required: true,
    },

    // Current payment status
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded"],
      default: "pending",
    },

    // External transaction ID
    // Useful for GCash, Maya, bank transfers, etc.
    transactionId: {
      type: String,
      trim: true,
      default: null,
    },

    // Date and time when payment was successfully completed
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
