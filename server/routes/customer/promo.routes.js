import express from "express";
import Promo from "../../models/Promo.js";

const router = express.Router();

// GET /api/customer/promos — active promos for the customer home carousel
router.get("/", async (req, res) => {
  try {
    const promos = await Promo.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: promos });
  } catch (err) {
    console.error("Get customer promos error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default router;
