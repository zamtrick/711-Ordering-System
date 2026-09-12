import express from "express";
import {
  getBranchesForAdmin,
  updateBranchDeliveryRange,
} from "../../controllers/admin/branch.controller.js";
import {
  resolveAdminBranch,
  requireBranchAccess,
} from "../../middlewares/branchScope.middleware.js";

const router = express.Router();

router.use(resolveAdminBranch);

// Lookup for forms: admins get only their branch, superadmins get all.
router.get("/", getBranchesForAdmin);

// Set a branch's delivery range (km radius) and map coordinates —
// admins may only configure their own branch.
router.patch("/:id/delivery-range", requireBranchAccess, updateBranchDeliveryRange);

export default router;
