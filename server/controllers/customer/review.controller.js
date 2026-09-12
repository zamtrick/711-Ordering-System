import mongoose from "mongoose";
import Review from "../../models/Review.js";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

// Recompute denormalized ratingAvg/ratingCount on the product from all
// visible reviews. Called after every create/delete/hide.
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

const fail = (res, status, message) => res.status(status).json({ success: false, message });

// --------------------------------------------------
// GET PRODUCT REVIEWS (public to logged-in customers)
// GET /api/customer/reviews/product/:productId
// --------------------------------------------------
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return fail(res, 400, "Invalid product ID");
    }

    const reviews = await Review.find({ product: productId, isHidden: false })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "firstname lastname")
      .lean();

    return res.status(200).json({
      success: true,
      data: reviews.map((r) => ({
        _id: r._id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        // Only the first name is shown publicly
        reviewer: r.user ? `${r.user.firstname} ${r.user.lastname?.[0] ?? ""}.` : "Customer",
      })),
    });
  } catch (err) {
    console.error("Get product reviews error:", err.message);
    return fail(res, 500, "Internal Server Error");
  }
};

// --------------------------------------------------
// REVIEW ELIGIBILITY FOR AN ORDER
// GET /api/customer/reviews/eligible/:orderId
// Returns the items the customer may review for this delivered order,
// including any review they already left (so the UI can show/edit state).
// --------------------------------------------------
export const getOrderEligibility = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return fail(res, 400, "Invalid order ID");
    }

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("orderItems")
      .lean();

    if (!order) return fail(res, 404, "Order not found");

    // Only completed (+ delivered) orders can be reviewed
    if (order.status !== "completed" || order.deliveryStatus !== "delivered") {
      return res.status(200).json({ success: true, data: { eligible: false, reason: "not_completed", items: [] } });
    }

    // Pull product ids out of the order items
    const items = (order.orderItems ?? []).map((oi) => ({
      orderItemId: oi._id,
      productId: typeof oi.product === "object" ? oi.product?._id : oi.product,
      productName: typeof oi.product === "object" ? oi.product?.name : undefined,
      quantity: oi.quantity,
    }));

    const productIds = items.map((i) => i.productId).filter(Boolean);

    const existing = await Review.find({
      user: userId,
      product: { $in: productIds },
    })
      .select("product rating comment")
      .lean();

    const existingMap = new Map(existing.map((r) => [r.product.toString(), r]));

    return res.status(200).json({
      success: true,
      data: {
        eligible: true,
        items: items
          .filter((i) => i.productId)
          .map((i) => ({
            ...i,
            myReview: existingMap.get(i.productId.toString()) ?? null,
          })),
      },
    });
  } catch (err) {
    console.error("Get review eligibility error:", err.message);
    return fail(res, 500, "Internal Server Error");
  }
};

// --------------------------------------------------
// CREATE / UPDATE MY REVIEW FOR A PRODUCT FROM AN ORDER
// POST /api/customer/reviews
// Body: { orderId, productId, rating, comment? }
// One review per user per product — re-submitting updates it.
// --------------------------------------------------
export const upsertReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId, productId, rating, comment } = req.body;

    if (!orderId || !productId || !mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return fail(res, 400, "Order ID and product ID are required");
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return fail(res, 400, "Rating must be a whole number from 1 to 5");
    }

    const cleanComment = typeof comment === "string" ? comment.trim().slice(0, 1000) : "";

    // The order must belong to this customer, be completed + delivered,
    // and actually contain the product being reviewed.
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      status: "completed",
      deliveryStatus: "delivered",
    })
      .populate("orderItems")
      .lean();

    if (!order) {
      return fail(res, 403, "You can only review products from your delivered orders.");
    }

    const containsProduct = (order.orderItems ?? []).some((oi) =>
      typeof oi.product === "object" ? oi.product?._id?.toString() === productId : oi.product?.toString() === productId,
    );

    if (!containsProduct) {
      return fail(res, 403, "This product is not part of the given order.");
    }

    // Upsert — one review per user per product
    const review = await Review.findOneAndUpdate(
      { user: userId, product: productId },
      {
        $set: {
          user: userId,
          product: productId,
          order: orderId,
          rating: ratingNum,
          comment: cleanComment,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await syncProductRating(productId);

    return res.status(200).json({
      success: true,
      message: "Review saved",
      data: review,
    });
  } catch (err) {
    console.error("Upsert review error:", err.message);
    return fail(res, 500, "Internal Server Error");
  }
};

// --------------------------------------------------
// DELETE MY REVIEW
// DELETE /api/customer/reviews/:reviewId
// --------------------------------------------------
export const deleteMyReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return fail(res, 400, "Invalid review ID");
    }

    const review = await Review.findOneAndDelete({
      _id: reviewId,
      user: req.user.userId,
    });

    if (!review) return fail(res, 404, "Review not found");

    await syncProductRating(review.product);

    return res.status(200).json({ success: true, message: "Review deleted" });
  } catch (err) {
    console.error("Delete review error:", err.message);
    return fail(res, 500, "Internal Server Error");
  }
};
