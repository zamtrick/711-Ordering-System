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

    // Expo push tokens for this customer's devices (one entry per device).
    // Registered by the customer app after the OS permission prompt and used
    // by services/push.service.js to send order/chat notifications.
    pushTokens: [
      {
        token: {
          type: String,
          trim: true,
          required: true,
        },
        platform: {
          type: String,
          enum: ["ios", "android", "web"],
          default: "android",
        },
        deviceName: {
          type: String,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        lastUsedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
