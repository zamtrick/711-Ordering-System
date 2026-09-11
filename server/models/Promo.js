import mongoose from "mongoose";

const promoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

promoSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

const Promo = mongoose.model("Promo", promoSchema);

export default Promo;
