import express from "express";
import Product from "../../models/Product.js";

const router = express.Router();

// GET /api/customer/products  — returns active products only
router.get("/", async (req, res) => {
  try {
    const { search, categoryId } = req.query;

    const query = { isActive: true };

    if (categoryId) query.categoryId = categoryId;

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const products = await Product.find(query)
      .populate("categoryId", "name")
      .sort({ createdAt: -1 });

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

// GET /api/customer/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate("categoryId", "name");

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
