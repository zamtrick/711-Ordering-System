import express from "express";
import {
  getDeliveryFeeHandler,
  updateDeliveryFeeHandler,
  getAdminPermissionsHandler,
  updateAdminPermissionsHandler,
  getRiderCapacityHandler,
  updateRiderCapacityHandler,
  getDeliveryVerificationHandler,
  updateDeliveryVerificationHandler,
  getDeliveryRangeHandler,
  updateDeliveryRangeHandler,
} from "../controllers/settings.controller.js";
import auth from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public: the customer app reads the fee before checkout (no auth required)
// GET /api/settings/delivery-fee
router.get("/delivery-fee", getDeliveryFeeHandler);

// Superadmin-only: the fee is platform-wide (branch admins get read-only UI)
// PUT /api/settings/delivery-fee
router.put("/delivery-fee", auth, authorize("superadmin"), updateDeliveryFeeHandler);

// Admin reads (for read-only UI), superadmin manages toggles
// GET /api/settings/admin-permissions
router.get(
  "/admin-permissions",
  auth,
  authorize("admin", "superadmin"),
  getAdminPermissionsHandler,
);

// Superadmin-only: toggle admin management of products/categories/riders
// PUT /api/settings/admin-permissions
router.put(
  "/admin-permissions",
  auth,
  authorize("superadmin"),
  updateAdminPermissionsHandler,
);

// Public: rider + customer apps read it to pick their delivery flow
// GET /api/settings/delivery-verification
router.get("/delivery-verification", getDeliveryVerificationHandler);

// Superadmin-only: choose QR + photo proof vs photo-only proof
// PUT /api/settings/delivery-verification
router.put(
  "/delivery-verification",
  auth,
  authorize("superadmin"),
  updateDeliveryVerificationHandler,
);

// Public: customer app reads it to warn out-of-range addresses at checkout
// GET /api/settings/delivery-range
router.get("/delivery-range", getDeliveryRangeHandler);

// Superadmin-only: platform-wide default delivery range (km)
// PUT /api/settings/delivery-range
router.put(
  "/delivery-range",
  auth,
  authorize("superadmin"),
  updateDeliveryRangeHandler,
);

// Admin reads (for load display), superadmin manages the cap
// GET /api/settings/rider-capacity
router.get(
  "/rider-capacity",
  auth,
  authorize("admin", "superadmin"),
  getRiderCapacityHandler,
);

// Superadmin-only: max concurrent active deliveries per rider
// PUT /api/settings/rider-capacity
router.put(
  "/rider-capacity",
  auth,
  authorize("superadmin"),
  updateRiderCapacityHandler,
);

export default router;
