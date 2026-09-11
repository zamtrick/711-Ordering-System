import express from "express";
import {
  getRiders,
  getRiderById,
  createRider,
  updateRiderById,
  deleteRiderById,
} from "../../controllers/admin/rider.controller.js";

import { requireAdminPermission } from "../../middlewares/adminPermissions.middleware.js";

const router = express.Router();

router.get("/", getRiders);
router.get("/:id", getRiderById);
router.post("/", requireAdminPermission("canManageRiders"), createRider);
router.patch("/:id", requireAdminPermission("canManageRiders"), updateRiderById);
router.delete("/:id", requireAdminPermission("canManageRiders"), deleteRiderById);

export default router;
