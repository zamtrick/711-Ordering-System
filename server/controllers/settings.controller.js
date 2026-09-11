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
