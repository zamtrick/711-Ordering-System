import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    branchCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethods: {
      type: [String], //square identifies this attribute is an array
      enum: ["cash", "card", "gcash", "maya", "bank_transfer", "other"],
      default: ["cash"],
      validate: {
        validator: (value) => value.length > 0,
        message: "At least one payment method is required",
      },
    },
    address: {
      street: {
        type: String,
        trim: true,
      },

      barangay: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      province: {
        type: String,
        trim: true,
      },

      postalCode: {
        type: String,
        trim: true,
      },
    },

    contactNumber: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active",
    },

    openingTime: {
      type: String,
    },

    closingTime: {
      type: String,
    },
  },
  { timestamps: true },
);

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;
