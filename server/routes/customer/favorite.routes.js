import express from "express";

import {
  getFavorites,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
} from "../../controllers/customer/favorite.controller.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| FAVORITE ROUTES
|--------------------------------------------------------------------------
*/

// List my favorites (full product details)
// GET /api/customer/favorites
router.get("/", getFavorites);

// Lightweight list of favorited product IDs (for heart states)
// GET /api/customer/favorites/ids
router.get("/ids", getFavoriteIds);

// Add a favorite
// POST /api/customer/favorites  { productId }
router.post("/", addFavorite);

// Remove a favorite
// DELETE /api/customer/favorites/:productId
router.delete("/:productId", removeFavorite);

export default router;
