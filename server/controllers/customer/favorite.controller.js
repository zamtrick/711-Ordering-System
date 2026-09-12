import mongoose from "mongoose";
import Favorite from "../../models/Favorite.js";
import Product from "../../models/Product.js";

/*
|--------------------------------------------------------------------------
| FAVORITES (WISHLIST)
|--------------------------------------------------------------------------
| Per-customer saved products. All routes assume `auth` middleware has run
| so req.user.userId is the logged-in customer.
|--------------------------------------------------------------------------
*/

// --------------------------------------------------
// GET MY FAVORITES
// GET /api/customer/favorites
// Returns favorited products, newest first. Favorites pointing at products
// that were since deleted/unlisted are skipped (and lazily cleaned up).
// --------------------------------------------------
export const getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "product",
        match: { isActive: true },
        select: "name price image stock categoryId",
        populate: { path: "categoryId", select: "name" },
      })
      .lean();

    const items = [];
    const staleIds = [];

    for (const fav of favorites) {
      // product is null when the match filter excluded it (deleted/unlisted)
      if (!fav.product) {
        staleIds.push(fav._id);
        continue;
      }
      items.push({
        _id: fav._id,
        createdAt: fav.createdAt,
        product: fav.product,
      });
    }

    // Lazily drop favorites whose product no longer exists
    if (staleIds.length > 0) {
      await Favorite.deleteMany({ _id: { $in: staleIds } }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: "Favorites retrieved successfully",
      data: items,
    });
  } catch (err) {
    console.error("Get favorites error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// --------------------------------------------------
// GET FAVORITE PRODUCT IDS
// GET /api/customer/favorites/ids
// Lightweight endpoint the product list uses to render heart states.
// --------------------------------------------------
export const getFavoriteIds = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.userId })
      .select("product")
      .lean();

    return res.status(200).json({
      success: true,
      data: favorites.map((f) => f.product.toString()),
    });
  } catch (err) {
    console.error("Get favorite ids error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// --------------------------------------------------
// ADD A FAVORITE
// POST /api/customer/favorites
// Body: { productId }
// Idempotent: re-adding an existing favorite returns 200, not an error.
// --------------------------------------------------
export const addFavorite = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const favorite = await Favorite.findOneAndUpdate(
      { user: req.user.userId, product: productId },
      { $setOnInsert: { user: req.user.userId, product: productId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return res.status(200).json({
      success: true,
      message: "Added to favorites",
      data: favorite,
    });
  } catch (err) {
    console.error("Add favorite error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// --------------------------------------------------
// REMOVE A FAVORITE
// DELETE /api/customer/favorites/:productId
// Idempotent: removing a non-existent favorite still returns 200.
// --------------------------------------------------
export const removeFavorite = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    await Favorite.findOneAndDelete({
      user: req.user.userId,
      product: productId,
    });

    return res.status(200).json({
      success: true,
      message: "Removed from favorites",
    });
  } catch (err) {
    console.error("Remove favorite error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
