import express from "express";

import {
  getAdminReviews,
  setReviewVisibility,
  deleteAdminReview,
} from "../../controllers/admin/review.controller.js";
import { resolveAdminBranch } from "../../middlewares/branchScope.middleware.js";

const router = express.Router();

// Branch scoping: admins moderate reviews for their branch's orders only.
router.use(resolveAdminBranch);

// GET /api/admin/reviews?filter=all|hidden|visible
router.get("/", getAdminReviews);

// PATCH /api/admin/reviews/:id/visibility  { isHidden }
router.patch("/:id/visibility", setReviewVisibility);

// DELETE /api/admin/reviews/:id
router.delete("/:id", deleteAdminReview);

export default router;
