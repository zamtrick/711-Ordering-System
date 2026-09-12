import express from "express";
import {
  getRiders,
  getRiderById,
  createRider,
  updateRiderById,
  deleteRiderById,
} from "../../controllers/admin/rider.controller.js";

import { requireAdminPermission } from "../../middlewares/adminPermissions.middleware.js";
import { resolveAdminBranch } from "../../middlewares/branchScope.middleware.js";
import { requireDeleteConfirmation } from "../../middlewares/deleteConfirm.middleware.js";

const router = express.Router();

// Admins see/manage only their branch's riders; superadmins see all.
router.use(resolveAdminBranch);

router.get("/", getRiders);
router.get("/:id", getRiderById);
router.post("/", requireAdminPermission("canManageRiders"), createRider);
router.patch("/:id", requireAdminPermission("canManageRiders"), updateRiderById);
router.delete(
  "/:id",
  requireAdminPermission("canManageRiders"),
  requireDeleteConfirmation,
  deleteRiderById
);

export default router;
