import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    // Customer who wrote the review
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Product being reviewed
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Order that qualifies this customer to review the product
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    // 1..5 stars
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    // Superadmin can hide abusive reviews without deleting them
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// One review per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Fast product review listings
reviewSchema.index({ product: 1, isHidden: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
