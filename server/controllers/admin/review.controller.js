import mongoose from "mongoose";
import Review from "../../models/Review.js";
import Product from "../../models/Product.js";
import Order from "../../models/Order.js";
import { isBranchScoped } from "../../middlewares/branchScope.middleware.js";

const fail = (res, status, message) => res.status(status).json({ success: false, message });

// --------------------------------------------------
// BRANCH SCOPING
// --------------------------------------------------
// Reviews are qualified by an order (Review.order). A branch admin only
// moderates reviews whose qualifying order was placed at their branch;
// superadmins moderate everything.
// --------------------------------------------------

// Review ids whose qualifying order belongs to the requester's branch
const branchReviewIds = async (branchId) => {
  const orders = await Order.find({ branch: branchId })
    .select("_id")
    .lean();
  return orders.map((o) => o._id.toString());
};

// Access guard for document-addressing routes. Returns the review when
// allowed, otherwise null (and the response has already been sent).
const findAccessibleReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    fail(res, 404, "Review not found");
    return null;
  }
  if (isBranchScoped(req)) {
    const ids = await branchReviewIds(req.adminBranchId);
    if (!ids.includes(review.order.toString())) {
      fail(res, 403, "You can only moderate reviews for orders at your branch.");
      return null;
    }
  }
  return review;
};

const syncProductRating = async (productId) => {
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), isHidden: false } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  await Product.findByIdAndUpdate(productId, {
    ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0,
    ratingCount: agg ? agg.count : 0,
  });
};

// --------------------------------------------------
// GET ALL REVIEWS (moderation list)
// GET /api/admin/reviews?filter=all|hidden|visible
// --------------------------------------------------
export const getAdminReviews = async (req, res) => {
  try {
    const { filter = "all" } = req.query;

    const query = {};
    if (filter === "hidden") query.isHidden = true;
    if (filter === "visible") query.isHidden = false;

    // Branch admins only see reviews tied to orders at their branch
    if (isBranchScoped(req)) {
      query.order = { $in: await branchReviewIds(req.adminBranchId) };
    }

    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("user", "firstname lastname email")
      .populate("product", "name image")
      .lean();

    return res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (err) {
    console.error("Get admin reviews error:", err.message);
    return fail(res, 500, "Internal Server Error");
  }
};

// --------------------------------------------------
// HIDE / SHOW A REVIEW
// PATCH /api/admin/reviews/:id/visibility  { isHidden: boolean }
// --------------------------------------------------
export const setReviewVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { isHidden } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "Invalid review ID");
    }

    const review = await findAccessibleReview(req, res);
    if (!review) return;

    const updated = await Review.findByIdAndUpdate(
      id,
      { isHidden: Boolean(isHidden) },
      { new: true },
    );

    if (!updated) return fail(res, 404, "Review not found");

    await syncProductRating(updated.product);

    return res.status(200).json({
      success: true,
      message: isHidden ? "Review hidden" : "Review visible",
      data: updated,
    });
  } catch (err) {
    console.error("Set review visibility error:", err.message);
    return fail(res, 500, "Internal Server Error");
  }
};

// --------------------------------------------------
// DELETE A REVIEW
// DELETE /api/admin/reviews/:id
// --------------------------------------------------
export const deleteAdminReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "Invalid review ID");
    }

    const review = await findAccessibleReview(req, res);
    if (!review) return;

    await Review.findByIdAndDelete(review._id);

    await syncProductRating(review.product);

    return res.status(200).json({ success: true, message: "Review deleted" });
  } catch (err) {
    console.error("Delete admin review error:", err.message);
    return fail(res, 500, "Internal Server Error");
  }
};
