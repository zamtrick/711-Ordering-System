import mongoose from "mongoose";

// One document per issued code. The plain code is NEVER stored — only its
// salted SHA-256 hash. Expired documents are auto-deleted by the TTL index
// on expiresAt, so no cleanup job is needed.
const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    codeHash: {
      type: String,
      required: true,
    },

    salt: {
      type: String,
      required: true,
    },

    purpose: {
      type: String,
      enum: ["verify", "reset"],
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      // TTL index — MongoDB removes the document shortly after expiry.
      index: { expires: 0 },
    },

    attempts: {
      type: Number,
      default: 0,
    },

    consumed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Fast lookup of the latest live code per email + purpose.
otpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

const Otp = mongoose.model("Otp", otpSchema);

export default Otp;
