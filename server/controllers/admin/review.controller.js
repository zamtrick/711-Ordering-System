import mongoose from "mongoose";
import Review from "../../models/Review.js";
import Product from "../../models/Product.js";

const fail = (res, status, message) => res.status(status).json({ success: false, message });

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

    const review = await Review.findByIdAndUpdate(
      id,
      { isHidden: Boolean(isHidden) },
      { new: true },
    );

    if (!review) return fail(res, 404, "Review not found");

    await syncProductRating(review.product);

    return res.status(200).json({
      success: true,
      message: isHidden ? "Review hidden" : "Review visible",
      data: review,
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

    const review = await Review.findByIdAndDelete(id);
    if (!review) return fail(res, 404, "Review not found");

    await syncProductRating(review.product);

    return res.status(200).json({ success: true, message: "Review deleted" });
  } catch (err) {
    console.error("Delete admin review error:", err.message);
    return fail(res, 500, "Internal Server Error");
  }
};
