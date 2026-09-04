import express from "express";
import Branch from "../../models/Branch.js";

const router = express.Router();

// GET /api/customer/branches  — returns active branches only
router.get("/", async (req, res) => {
  try {
    const branches = await Branch.find({ status: "active" }).select(
      "name branchCode location address contactNumber openingTime closingTime",
    );

    return res.status(200).json({
      success: true,
      data: branches,
    });
  } catch (err) {
    console.error("Get branches error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

export default router;
