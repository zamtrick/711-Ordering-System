import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    age: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
