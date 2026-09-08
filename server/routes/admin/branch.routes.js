import express from "express";
import {
  getBranchesForAdmin,
  updateBranchDeliveryRange,
} from "../../controllers/admin/branch.controller.js";

const router = express.Router();

router.get("/", getBranchesForAdmin);

// Set a branch's delivery range (km radius) and map coordinates
router.patch("/:id/delivery-range", updateBranchDeliveryRange);

export default router;
