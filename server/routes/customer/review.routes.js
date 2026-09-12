import express from "express";

import {
  getProductReviews,
  getOrderEligibility,
  upsertReview,
  deleteMyReview,
} from "../../controllers/customer/review.controller.js";

const router = express.Router();

// Public-to-customers review list for a product
// GET /api/customer/reviews/product/:productId
router.get("/product/:productId", getProductReviews);

// What can I review for this order?
// GET /api/customer/reviews/eligible/:orderId
router.get("/eligible/:orderId", getOrderEligibility);

// Create/update my review
// POST /api/customer/reviews  { orderId, productId, rating, comment? }
router.post("/", upsertReview);

// Delete my review
// DELETE /api/customer/reviews/:reviewId
router.delete("/:reviewId", deleteMyReview);

export default router;
