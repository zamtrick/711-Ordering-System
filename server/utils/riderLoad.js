import Order from "../models/Order.js";

/*
|--------------------------------------------------------------------------
| Rider load helpers (shared by rider self-accept + admin manual assign)
|--------------------------------------------------------------------------
| Small branches (1-2 riders) overload fast, so both entry points enforce
| the same cap and keep availabilityStatus in sync:
|   active > 0  -> "delivering" (unless the rider set themselves "offline")
|   active = 0  -> "available"  (never force an "offline" rider back online)
|--------------------------------------------------------------------------
*/

export const MAX_ACTIVE_DELIVERIES_PER_RIDER = 3;

export const ACTIVE_DELIVERY_STATUSES = ["assigned", "picked_up", "in_transit"];

// Live cap from superadmin settings (Setting.maxActiveDeliveriesPerRider),
// falling back to the constant above when unset/invalid/DB unreachable.
// Dynamic import avoids a controller<->util cycle (settings.controller
// imports the audit controller, which rider controllers also touch).
export const getMaxActiveDeliveries = async () => {
  try {
    const { getMaxActiveDeliveries: readSetting } = await import(
      "../controllers/settings.controller.js"
    );
    return await readSetting();
  } catch {
    return MAX_ACTIVE_DELIVERIES_PER_RIDER;
  }
};

export const countActiveDeliveries = async (riderId) => {
  if (!riderId) return 0;
  return Order.countDocuments({
    rider: riderId,
    deliveryStatus: { $in: ACTIVE_DELIVERY_STATUSES },
  });
};

export const refreshRiderAvailability = async (riderDoc) => {
  if (!riderDoc) return;
  if (riderDoc.availabilityStatus === "offline") return;
  const active = await countActiveDeliveries(riderDoc._id);
  const next = active > 0 ? "delivering" : "available";
  if (riderDoc.availabilityStatus !== next) {
    riderDoc.availabilityStatus = next;
    await riderDoc.save();
  }
};
