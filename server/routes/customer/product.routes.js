import express from "express";
import mongoose from "mongoose";
import Product from "../../models/Product.js";
import BranchProduct from "../../models/BranchProduct.js";
import OrderItem from "../../models/OrderItem.js";

const router = express.Router();

// GET /api/customer/products
// Query params:
//   branchId   — filter to products available at this branch (with branch stock)
//   search     — name substring match
//   categoryId — filter by category
router.get("/", async (req, res) => {
  try {
    const { search, categoryId, branchId } = req.query;

    const query = { isActive: true };
    if (categoryId) query.categoryId = categoryId;
    if (search) query.name = { $regex: search, $options: "i" };

    const products = await Product.find(query)
      .populate("categoryId", "name image")
      .sort({ createdAt: -1 });

    // ── Branch filter ──────────────────────────────────────────────────────
    // When branchId is supplied we join BranchProduct records and:
    //   1. Drop products that have no record (not configured for this branch)
    //      OR that are explicitly marked isAvailable: false.
    //   2. Override each product's stock with the branch-local value when set.
    // When no branchId is supplied we return the full global catalogue so the
    // "All Branches" view still works.
    // ──────────────────────────────────────────────────────────────────────

    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      // Fetch all BranchProduct records for this branch in one query
      const branchInventory = await BranchProduct.find({
        branch: branchId,
      }).lean();

      // Build a fast lookup map: productId → BranchProduct record
      const inventoryMap = new Map(
        branchInventory.map((bp) => [bp.product.toString(), bp]),
      );

      const filtered = [];

      for (const product of products) {
        const record = inventoryMap.get(product._id.toString());

        // No record → product not configured for this branch → skip
        if (!record) continue;

        // Explicitly unavailable → skip
        if (!record.isAvailable) continue;

        // Apply branch-local stock override when set
        const plain = product.toObject();
        if (record.stock !== null && record.stock !== undefined) {
          plain.stock = record.stock;
        }

        filtered.push(plain);
      }

      return res.status(200).json({
        success: true,
        message: "Products retrieved",
        data: filtered,
      });
    }

    // No branchId — return global catalogue as-is
    return res.status(200).json({
      success: true,
      message: "Products retrieved",
      data: products,
    });
  } catch (err) {
    console.error("Get customer products error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// GET /api/customer/products/:id/bought-together
// Products most frequently ordered in the same order as :id (co-purchase
// frequency, ranked by total quantity across those orders). Powers the
// "Frequently bought together" shelf on the product screen.
router.get("/:id/bought-together", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const limitParam = Number(req.query.limit);
    const limit =
      Number.isFinite(limitParam) && limitParam >= 1
        ? Math.min(Math.floor(limitParam), 12)
        : 6;

    const pid = new mongoose.Types.ObjectId(id);

    // 1. Find every order that contains this product.
    // 2. Pull all sibling items from those same orders.
    // 3. Rank the other products by total quantity.
    const ranked = await OrderItem.aggregate([
      { $match: { product: pid } },
      { $group: { _id: "$order" } },
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "order",
          as: "siblings",
        },
      },
      { $unwind: "$siblings" },
      { $match: { "siblings.product": { $ne: pid } } },
      {
        $group: {
          _id: "$siblings.product",
          count: { $sum: "$siblings.quantity" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    if (ranked.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const countMap = new Map(
      ranked.map((r) => [r._id.toString(), r.count]),
    );

    const products = await Product.find({
      _id: { $in: ranked.map((r) => r._id) },
      isActive: true,
    }).populate("categoryId", "name image");

    // Preserve the frequency ranking and expose the count to the client.
    const data = products
      .map((p) => ({
        ...p.toObject(),
        boughtTogetherCount: countMap.get(p._id.toString()) ?? 0,
      }))
      .sort((a, b) => b.boughtTogetherCount - a.boughtTogetherCount);

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Bought together error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// GET /api/customer/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate("categoryId", "name image");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("Get product by id error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

export default router;
