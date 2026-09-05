import express from "express";
import {
  getAuditLogs,
  getRecentActivity,
  getAuditStats,
} from "../../controllers/superadmin/audit.controller.js";

const router = express.Router();

router.get("/logs", getAuditLogs);
router.get("/recent", getRecentActivity);
router.get("/stats", getAuditStats);

export default router;
