import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    // Customer who favorited the product
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Favorited product
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// A customer can favorite a given product only once
favoriteSchema.index({ user: 1, product: 1 }, { unique: true });

// Fast "my favorites" listing
favoriteSchema.index({ user: 1, createdAt: -1 });

const Favorite = mongoose.model("Favorite", favoriteSchema);

export default Favorite;
