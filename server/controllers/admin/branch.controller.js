import mongoose from "mongoose";
import Branch from "../../models/Branch.js";

// ==========================================
// GET BRANCHES (Admin lookup for forms)
// ==========================================
export const getBranchesForAdmin = async (req, res) => {
  try {
    const branches = await Branch.find().sort({ name: 1 });
    return res.status(200).json({ success: true, branches });
  } catch (err) {
    console.error("Admin branch lookup error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// UPDATE BRANCH DELIVERY RANGE
// ==========================================
// Body: { deliveryRange: 2, lat: 14.5995, lng: 120.9842 }
// The delivery range is a radius in km; lat/lng are the branch location
// (WGS84) used to draw the range circle and validate orders.
export const updateBranchDeliveryRange = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryRange, lat, lng } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid branch ID" });
    }

    // Validate delivery range — whole km, 0 to 100
    const range = Number(deliveryRange);
    if (!Number.isFinite(range) || range < 0 || range > 100) {
      return res.status(400).json({
        success: false,
        message: "Delivery range must be a number between 0 and 100 km",
      });
    }

    // Validate coordinates if provided
    const parsedLat = lat === undefined ? undefined : Number(lat);
    const parsedLng = lng === undefined ? undefined : Number(lng);

    if (parsedLat !== undefined && (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
      return res.status(400).json({ success: false, message: "Latitude must be between -90 and 90" });
    }
    if (parsedLng !== undefined && (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
      return res.status(400).json({ success: false, message: "Longitude must be between -180 and 180" });
    }

    const update = { deliveryRange: Math.round(range) };
    if (parsedLat !== undefined) update["coordinates.lat"] = parsedLat;
    if (parsedLng !== undefined) update["coordinates.lng"] = parsedLng;

    const branch = await Branch.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    return res.status(200).json({ success: true, branch });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ success: false, message: Object.values(err.errors)[0]?.message ?? "Invalid data" });
    }
    console.error("Update branch delivery range error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
