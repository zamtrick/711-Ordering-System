import express from "express";
import mongoose from "mongoose";
import Branch from "../../models/Branch.js";

const router = express.Router();

// GET /api/customer/branches  — returns active branches only
router.get("/", async (req, res) => {
  try {
    const branches = await Branch.find({ status: "active" }).select(
      "name branchCode location address contactNumber openingTime closingTime paymentMethods",
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

// GET /api/customer/branches/:id  — single branch detail
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const branch = await Branch.findOne({ _id: id, status: "active" }).select(
      "name branchCode location address contactNumber openingTime closingTime paymentMethods",
    );

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: branch,
    });
  } catch (err) {
    console.error("Get branch by id error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

export default router;
