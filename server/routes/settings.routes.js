import express from "express";
import { getDeliveryFeeHandler, updateDeliveryFeeHandler } from "../controllers/settings.controller.js";
import auth from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public: the customer app reads the fee before checkout (no auth required)
// GET /api/settings/delivery-fee
router.get("/delivery-fee", getDeliveryFeeHandler);

// Admin-only: adjust the fee
// PUT /api/settings/delivery-fee
router.put("/delivery-fee", auth, authorize("admin", "superadmin"), updateDeliveryFeeHandler);

export default router;
