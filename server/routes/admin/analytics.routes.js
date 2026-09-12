import express from "express";
import { getAdminDashboard } from "../../controllers/admin/analytics.controller.js";
import { resolveAdminBranch } from "../../middlewares/branchScope.middleware.js";

const router = express.Router();

// Dashboard numbers are branch-scoped for regular admins.
router.use(resolveAdminBranch);
router.get("/dashboard", getAdminDashboard);

export default router;
