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

    addresses: [
      {
        label: {
          type: String,
          default: "Home",
        },
        address: {
          type: String,
          trim: true,
        },
        // Map pin position (WGS84) captured by the in-app map picker.
        // Optional — manually typed addresses have no coordinates and skip
        // the branch delivery-range check at order time.
        lat: {
          type: Number,
          min: -90,
          max: 90,
          default: null,
        },
        lng: {
          type: Number,
          min: -180,
          max: 180,
          default: null,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],

    age: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
