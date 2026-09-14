import express from "express";

import {
  getAdminOrders,
  updateOrderStatus,
  assignOrderRider,
} from "../../controllers/admin/order.controller.js";
import { resolveAdminBranch } from "../../middlewares/branchScope.middleware.js";

const router = express.Router();

// Admins are scoped to their assigned branch; superadmins see everything.
router.use(resolveAdminBranch);

// List all orders (admin / superadmin)
router.get("/", getAdminOrders);

// Transition an order: processing | completed | cancelled | refunded
router.patch("/:id/status", updateOrderStatus);

// Manually assign / reassign / unassign a rider (branch-scoped, capped)
router.patch("/:id/rider", assignOrderRider);

export default router;
