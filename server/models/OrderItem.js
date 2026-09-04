import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    // The order this item belongs to
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    // The product being ordered
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // Price per unit at the time of order
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // quantity × unitPrice
    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true },
);

const OrderItem = mongoose.model("OrderItem", orderItemSchema);

export default OrderItem;
