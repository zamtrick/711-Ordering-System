import express from "express";
import {
  getBranchInventory,
  upsertBranchProduct,
  bulkUpsertBranchInventory,
} from "../../controllers/admin/branchInventory.controller.js";
import {
  resolveAdminBranch,
  requireBranchAccess,
} from "../../middlewares/branchScope.middleware.js";

const router = express.Router();

router.use(resolveAdminBranch);

// GET  /api/admin/branch-inventory/:branchId
//   → full product list with availability + stock for that branch
router.get("/:branchId", requireBranchAccess, getBranchInventory);

// PUT  /api/admin/branch-inventory/:branchId/products/:productId
//   → create or update a single product's availability/stock for a branch
router.put("/:branchId/products/:productId", requireBranchAccess, upsertBranchProduct);

// PATCH /api/admin/branch-inventory/:branchId/bulk
//   → update multiple products at once
router.patch("/:branchId/bulk", requireBranchAccess, bulkUpsertBranchInventory);

export default router;
