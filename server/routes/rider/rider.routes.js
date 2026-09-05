import express from "express";
import {
  getProfile,
  updateProfile,
  updateAvailability,
  getAvailableDeliveries,
  getMyDeliveries,
  getDeliveryHistory,
  acceptDelivery,
  updateDeliveryStatus,
  getStats,
} from "../../controllers/rider/rider.controller.js";

const router = express.Router();

// Profile
router.get("/profile/me", getProfile);
router.patch("/profile/me", updateProfile);

// Availability
router.patch("/availability", updateAvailability);

// Stats
router.get("/stats", getStats);

// Deliveries
router.get("/deliveries/available", getAvailableDeliveries);
router.get("/deliveries/mine", getMyDeliveries);
router.get("/deliveries/history", getDeliveryHistory);
router.patch("/deliveries/:id/accept", acceptDelivery);
router.patch("/deliveries/:id/status", updateDeliveryStatus);

export default router;
