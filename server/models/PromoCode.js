import mongoose from "mongoose";

const promoCodeSchema = new mongoose.Schema(
  {
    // Customer-facing code — normalized to uppercase, e.g. "SAVE10".
    // Distinct from the Promo model, which is the home-screen banner carousel.
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // "percent" → value is 1–100 (%), "fixed" → value is pesos (₱).
    type: {
      type: String,
      enum: ["percent", "fixed"],
      required: true,
    },

    value: {
      type: Number,
      required: true,
      min: 0,
    },

    // Peso value above which this code applies. Applies to the items subtotal
    // only; minOrderAmount: 0 means no minimum.
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Cap on the money a percent code can knock off. null = no cap (the
    // discount is already bounded by the items subtotal).
    maxDiscount: {
      type: Number,
      default: null,
      min: 0,
    },

    // Total redemptions allowed across all customers. usedCount is the
    // number of orders currently holding this code (pending or beyond —
    // released only when the code is removed or the order is cancelled).
    maxUses: {
      type: Number,
      default: null,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Times a single customer can use this code. null = unlimited.
    perUserLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    // Scheduling window. startsAt defaults to now; endsAt null = never expires.
    startsAt: {
      type: Date,
      default: Date.now,
    },

    endsAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

const PromoCode = mongoose.model("PromoCode", promoCodeSchema);

export default PromoCode;
