import mongoose from "mongoose";
import Setting from "../models/Setting.js";
import { logAction } from "./superadmin/audit.controller.js";
import {
  ADMIN_PERMISSIONS_KEY,
  DEFAULT_ADMIN_PERMISSIONS,
  getAdminPermissionsMap,
} from "../middlewares/adminPermissions.middleware.js";

// --------------------------------------------------
// Constants
// --------------------------------------------------

const DELIVERY_FEE_KEY = "deliveryFee";
const DEFAULT_DELIVERY_FEE = 20;
const MAX_DELIVERY_FEE = 10000;

// Max concurrent active deliveries per rider. Small branches (1-2 riders)
// tune this from the superadmin Settings page instead of a code change.
const RIDER_CAPACITY_KEY = "maxActiveDeliveriesPerRider";
export const DEFAULT_RIDER_CAPACITY = 3;
const MIN_RIDER_CAPACITY = 1;
const MAX_RIDER_CAPACITY = 20;

// Delivery verification flow. "qr_and_photo" = rider scans the customer's QR
// before the photo proof step. "photo_only" = camera photo is the only proof.
const DELIVERY_VERIFICATION_KEY = "deliveryVerificationMode";
const DELIVERY_VERIFICATION_MODES = ["qr_and_photo", "photo_only"];
export const DEFAULT_DELIVERY_VERIFICATION_MODE = "qr_and_photo";

// Platform-wide default delivery range in km. Branches can override it with
// their own deliveryRange (admin Branches page); branches that never set one
// (or have the sentinel 0 meaning "no override") fall back to this value.
const DEFAULT_DELIVERY_RANGE_KEY = "defaultDeliveryRangeKm";
export const DEFAULT_DELIVERY_RANGE_KM = 2;
const MIN_DELIVERY_RANGE_KM = 1;
const MAX_DELIVERY_RANGE_KM = 100;

/**
 * Shared helper — resolves the effective delivery range for a branch.
 * Branch override > platform-wide default. Used by order creation to
 * validate that the customer's pinned address is within range.
 */
export const getEffectiveDeliveryRange = async (branchDoc) => {
  let defaultRange = DEFAULT_DELIVERY_RANGE_KM;
  try {
    const setting = await Setting.findOne({ key: DEFAULT_DELIVERY_RANGE_KEY });
    if (setting) {
      const parsed = Number(setting.value);
      if (Number.isFinite(parsed) && parsed >= MIN_DELIVERY_RANGE_KM) {
        defaultRange = parsed;
      }
    }
  } catch {
    // fall back to the built-in default
  }

  // A branch with no explicit range (undefined or 0) uses the default.
  const override = Number(branchDoc?.deliveryRange);
  if (!Number.isFinite(override) || override <= 0) return defaultRange;
  return override;
};

/**
 * Haversine distance between two WGS84 points, in kilometers.
 */
export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/**
 * Shared helper — used by the rider QR/scan/complete endpoints and the
 * customer QR endpoint to branch between the two delivery flows.
 */
export const getDeliveryVerificationMode = async () => {
  try {
    const setting = await Setting.findOne({ key: DELIVERY_VERIFICATION_KEY });
    if (!setting) return DEFAULT_DELIVERY_VERIFICATION_MODE;
    return DELIVERY_VERIFICATION_MODES.includes(setting.value)
      ? setting.value
      : DEFAULT_DELIVERY_VERIFICATION_MODE;
  } catch {
    return DEFAULT_DELIVERY_VERIFICATION_MODE;
  }
};

// --------------------------------------------------
// Shared helper — used by order creation to read the current fee
// --------------------------------------------------

export const getCurrentDeliveryFee = async () => {
  const setting = await Setting.findOne({ key: DELIVERY_FEE_KEY });

  if (!setting) return DEFAULT_DELIVERY_FEE;

  const parsed = Number(setting.value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DELIVERY_FEE;
};

// --------------------------------------------------
// GET DELIVERY FEE (public — customers read it before checkout)
// GET /api/settings/delivery-fee
// --------------------------------------------------

export const getDeliveryFeeHandler = async (req, res) => {
  try {
    const fee = await getCurrentDeliveryFee();

    return res.status(200).json({
      success: true,
      data: { fee },
    });
  } catch (err) {
    console.error("Get delivery fee error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// --------------------------------------------------
// UPDATE DELIVERY FEE (admin-only)
// PUT /api/settings/delivery-fee
// Body: { "fee": 20 }
// --------------------------------------------------

export const updateDeliveryFeeHandler = async (req, res) => {
  try {
    const { fee } = req.body;

    // Validate — whole pesos, between 0 and a sane ceiling
    if (typeof fee !== "number" || !Number.isFinite(fee) || fee < 0) {
      return res.status(400).json({
        success: false,
        message: "Fee must be a number greater than or equal to 0",
      });
    }

    if (fee > MAX_DELIVERY_FEE) {
      return res.status(400).json({
        success: false,
        message: `Fee cannot exceed ${MAX_DELIVERY_FEE}`,
      });
    }

    const rounded = Math.round(fee);

    const setting = await Setting.findOneAndUpdate(
      { key: DELIVERY_FEE_KEY },
      {
        value: String(rounded),
        updatedBy: req.user?.userId ?? null,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    // Audit trail (best-effort, non-blocking)
    logAction(
      req.user?.userId,
      "update_delivery_fee",
      "setting",
      setting._id,
      { fee: rounded },
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Delivery fee updated",
      data: { fee: Number(setting.value) },
    });
  } catch (err) {
    console.error("Update delivery fee error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// --------------------------------------------------
// GET ADMIN PERMISSIONS (admin reads for read-only UI, superadmin manages)
// GET /api/settings/admin-permissions
// --------------------------------------------------
export const getAdminPermissionsHandler = async (req, res) => {
  try {
    const permissions = await getAdminPermissionsMap();
    return res.status(200).json({ success: true, data: permissions });
  } catch (err) {
    console.error("Get admin permissions error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// UPDATE ADMIN PERMISSIONS (superadmin-only)
// PUT /api/settings/admin-permissions
// Body: { canManageProducts?: boolean, canManageCategories?: boolean, canManageRiders?: boolean }
// --------------------------------------------------

export const updateAdminPermissionsHandler = async (req, res) => {
  try {
    const { canManageProducts, canManageCategories, canManageRiders } = req.body ?? {};
    const current = await getAdminPermissionsMap();

    const next = {
      canManageProducts:
        typeof canManageProducts === "boolean" ? canManageProducts : current.canManageProducts,
      canManageCategories:
        typeof canManageCategories === "boolean"
          ? canManageCategories
          : current.canManageCategories,
      canManageRiders:
        typeof canManageRiders === "boolean" ? canManageRiders : current.canManageRiders,
    };

    const setting = await Setting.findOneAndUpdate(
      { key: ADMIN_PERMISSIONS_KEY },
      { value: JSON.stringify(next), updatedBy: req.user?.userId ?? null },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    logAction(
      req.user?.userId,
      "update_admin_permissions",
      "setting",
      setting._id,
      next,
    ).catch(() => {});

    return res.status(200).json({ success: true, message: "Permissions updated", data: next });
  } catch (err) {
    console.error("Update admin permissions error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// GET DELIVERY VERIFICATION MODE (rider/customer apps read it to pick a flow)
// GET /api/settings/delivery-verification
// --------------------------------------------------
export const getDeliveryVerificationHandler = async (req, res) => {
  try {
    const mode = await getDeliveryVerificationMode();
    return res.status(200).json({ success: true, data: { mode } });
  } catch (err) {
    console.error("Get delivery verification mode error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// UPDATE DELIVERY VERIFICATION MODE (superadmin-only)
// PUT /api/settings/delivery-verification
// Body: { "mode": "qr_and_photo" | "photo_only" }
// --------------------------------------------------
export const updateDeliveryVerificationHandler = async (req, res) => {
  try {
    const { mode } = req.body ?? {};

    if (!DELIVERY_VERIFICATION_MODES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Mode must be one of: ${DELIVERY_VERIFICATION_MODES.join(", ")}`,
      });
    }

    const setting = await Setting.findOneAndUpdate(
      { key: DELIVERY_VERIFICATION_KEY },
      { value: mode, updatedBy: req.user?.userId ?? null },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    logAction(
      req.user?.userId,
      "update_delivery_verification",
      "setting",
      setting._id,
      { mode },
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Delivery verification mode updated",
      data: { mode: setting.value },
    });
  } catch (err) {
    console.error("Update delivery verification mode error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// GET DEFAULT DELIVERY RANGE (admin reads for read-only UI, customer app
// reads it to warn out-of-range addresses at checkout)
// GET /api/settings/delivery-range
// --------------------------------------------------
export const getDeliveryRangeHandler = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: DEFAULT_DELIVERY_RANGE_KEY });
    let range = DEFAULT_DELIVERY_RANGE_KM;
    if (setting) {
      const parsed = Number(setting.value);
      if (Number.isFinite(parsed) && parsed >= MIN_DELIVERY_RANGE_KM) range = parsed;
    }
    return res.status(200).json({ success: true, data: { rangeKm: range } });
  } catch (err) {
    console.error("Get delivery range error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// UPDATE DEFAULT DELIVERY RANGE (superadmin-only)
// PUT /api/settings/delivery-range
// Body: { "rangeKm": 2 }
// --------------------------------------------------
export const updateDeliveryRangeHandler = async (req, res) => {
  try {
    const { rangeKm } = req.body ?? {};
    const range = Number(rangeKm);

    if (!Number.isFinite(range) || range < MIN_DELIVERY_RANGE_KM || range > MAX_DELIVERY_RANGE_KM) {
      return res.status(400).json({
        success: false,
        message: `Range must be between ${MIN_DELIVERY_RANGE_KM} and ${MAX_DELIVERY_RANGE_KM} km`,
      });
    }

    const rounded = Math.round(range);

    const setting = await Setting.findOneAndUpdate(
      { key: DEFAULT_DELIVERY_RANGE_KEY },
      { value: String(rounded), updatedBy: req.user?.userId ?? null },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    logAction(
      req.user?.userId,
      "update_delivery_range",
      "setting",
      setting._id,
      { rangeKm: rounded },
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Default delivery range updated",
      data: { rangeKm: Number(setting.value) },
    });
  } catch (err) {
    console.error("Update delivery range error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// Shared helper — used by rider self-accept + admin manual assign
// to read the live cap (falls back to DEFAULT_RIDER_CAPACITY)
// --------------------------------------------------

export const getMaxActiveDeliveries = async () => {
  try {
    const setting = await Setting.findOne({ key: RIDER_CAPACITY_KEY });
    if (!setting) return DEFAULT_RIDER_CAPACITY;
    const parsed = Number(setting.value);
    if (!Number.isFinite(parsed)) return DEFAULT_RIDER_CAPACITY;
    const rounded = Math.round(parsed);
    if (rounded < MIN_RIDER_CAPACITY || rounded > MAX_RIDER_CAPACITY) {
      return DEFAULT_RIDER_CAPACITY;
    }
    return rounded;
  } catch {
    return DEFAULT_RIDER_CAPACITY;
  }
};

// --------------------------------------------------
// GET RIDER CAPACITY (admin reads for load display, superadmin manages)
// GET /api/settings/rider-capacity
// --------------------------------------------------

export const getRiderCapacityHandler = async (req, res) => {
  try {
    const capacity = await getMaxActiveDeliveries();
    return res.status(200).json({ success: true, data: { capacity } });
  } catch (err) {
    console.error("Get rider capacity error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// UPDATE RIDER CAPACITY (superadmin-only)
// PUT /api/settings/rider-capacity
// Body: { "capacity": 3 }
// --------------------------------------------------

export const updateRiderCapacityHandler = async (req, res) => {
  try {
    const { capacity } = req.body;

    if (typeof capacity !== "number" || !Number.isFinite(capacity)) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a number",
      });
    }

    const rounded = Math.round(capacity);
    if (rounded < MIN_RIDER_CAPACITY || rounded > MAX_RIDER_CAPACITY) {
      return res.status(400).json({
        success: false,
        message: `Capacity must be between ${MIN_RIDER_CAPACITY} and ${MAX_RIDER_CAPACITY}`,
      });
    }

    const setting = await Setting.findOneAndUpdate(
      { key: RIDER_CAPACITY_KEY },
      { value: String(rounded), updatedBy: req.user?.userId ?? null },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    logAction(
      req.user?.userId,
      "update_rider_capacity",
      "setting",
      setting._id,
      { capacity: rounded },
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Rider capacity updated",
      data: { capacity: rounded },
    });
  } catch (err) {
    console.error("Update rider capacity error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
