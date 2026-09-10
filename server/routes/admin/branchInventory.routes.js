import express from "express";
import {
  getBranchInventory,
  upsertBranchProduct,
  bulkUpsertBranchInventory,
} from "../../controllers/admin/branchInventory.controller.js";

const router = express.Router();

// GET  /api/admin/branch-inventory/:branchId
//   → full product list with availability + stock for that branch
router.get("/:branchId", getBranchInventory);

// PUT  /api/admin/branch-inventory/:branchId/products/:productId
//   → create or update a single product's availability/stock for a branch
router.put("/:branchId/products/:productId", upsertBranchProduct);

// PATCH /api/admin/branch-inventory/:branchId/bulk
//   → update multiple products at once
router.patch("/:branchId/bulk", bulkUpsertBranchInventory);

export default router;
