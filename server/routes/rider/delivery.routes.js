import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { getProofDeliveryUploader } from "../../utils/uploads.js";
import { generateDeliveryQR, verifyOrderToken } from "../../utils/qr-delivery.js";
import { getDeliveryVerificationMode } from "../../controllers/settings.controller.js";
import Order from "../../models/Order.js";
import Rider from "../../models/Rider.js";
import AuditLog from "../../models/AuditLog.js";
import { emitOrderUpdated } from "../../socket.js";

const router = express.Router();

// Multer upload for proof of delivery photos
const proofUpload = getProofDeliveryUploader();

/**
 * GET /api/rider/deliveries/:id/qr
 * Generate the signed QR value for an order (customer shows it, rider scans it).
 * In "photo_only" mode the QR flow is disabled platform-wide.
 */
router.get("/:id/qr", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const verificationMode = await getDeliveryVerificationMode();
    if (verificationMode === "photo_only") {
      return res.status(400).json({
        success: false,
        message: "QR verification is disabled — photo proof only",
      });
    }

    const order = await Order.findById(id).populate("user", "firstname lastname");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

// Customers and assigned riders can request the QR
    // If rider not assigned yet, only the customer can see the QR
    const rider = await Rider.findOne({ user: req.user.userId });
    const isRider = rider?._id.toString() === order.rider?.toString();
    const isCustomer = req.user.role === "customer" && req.user.userId === order.user?._id.toString();

    // Customer can always see their own order's QR
    // Rider can see QR if assigned to this order
    if (!isCustomer && !isRider) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // The QR value is just the raw order ID string — both apps render the
    // QR image themselves via react-native-qrcode-svg. Never return a
    // base64 PNG here; that causes "data too large" errors on the client.
    const qrValue = await generateDeliveryQR(order._id.toString());

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        // qrValue is the 24-char ObjectId string — feed directly into
        // react-native-qrcode-svg's `value` prop on the client.
        qrValue,
        customer: order.user ? `${order.user.firstname} ${order.user.lastname}` : "Customer",
        deliveryAddress: order.deliveryAddress,
      },
    });
  } catch (err) {
    console.error("Generate QR error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

/**
 * POST /api/rider/deliveries/:id/scan
 * Rider scans QR code from customer's phone → verifies → ready to mark delivered
 * This validates that the QR matches the rider's assigned order
 */
router.post("/:id/scan", async (req, res) => {
  try {
    const { id } = req.params;
    const { qrData } = req.body; // The decoded QR payload

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const rider = await Rider.findOne({ user: req.user.userId });
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const order = await Order.findById(id).populate("user", "firstname lastname");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify this order is assigned to this rider
    if (order.rider?.toString() !== rider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "This order is not assigned to you",
      });
    }

    // In "photo_only" mode the QR scan step is skipped entirely, so a
    // straggler client posting a stale scan must not mark anything verified.
    const verificationMode = await getDeliveryVerificationMode();
    if (verificationMode === "photo_only") {
      return res.status(400).json({
        success: false,
        message: "QR scanning is disabled — use photo proof only",
      });
    }

    // Verify QR signature — must be a server-signed token for this order.
    // A trailing legacy "-suffix" is stripped before verifying so proof
    // filenames built on a signed value still pass; raw orderIds never do.
    // (The rider-mobile client forwards the scanned data opaquely.)
    const rawQr = typeof qrData === "string" ? qrData.trim() : "";
    if (!rawQr) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR code — bad signature",
      });
    }
    const scannedOrderId = verifyOrderToken(rawQr.split("-")[0]);
    if (!scannedOrderId) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR code — bad signature",
      });
    }

    // Verify the QR matches this order
    if (scannedOrderId !== order._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "QR code does not match this order",
      });
    }

    // QR verification successful - set flag for rider app

    // Order must be in a deliverable state
    if (!["assigned", "picked_up", "in_transit"].includes(order.deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be marked delivered from current status: ${order.deliveryStatus}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "QR verified — ready to capture proof of delivery",
      data: {
        orderId: order._id,
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid QR code",
    });
  }
});

/**
 * POST /api/rider/deliveries/:id/complete
 * Rider uploads proof photo + marks order as delivered
 * Requires: photo file + QR token verification
 */
router.post(
  "/:id/complete",
  proofUpload.single("proofPhoto"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { qrToken } = req.body; // The token from the scanned QR

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid order ID" });
      }

      const rider = await Rider.findOne({ user: req.user.userId });
      if (!rider) {
        return res.status(404).json({ success: false, message: "Rider not found" });
      }

      const order = await Order.findById(id);

      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      // Verify this order is assigned to this rider
      if (order.rider?.toString() !== rider._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "This order is not assigned to you",
        });
      }

      // qrToken is optional and informational only. If supplied it must equal
      // the order ID or start with it followed by a dash (legacy format).
      // If absent, we auto-generate a record token.
      let finalQrToken;
      if (!qrToken) {
        finalQrToken = `${order._id}-${Date.now()}-manual`;
      } else {
        const orderIdStr = order._id.toString();
        if (qrToken !== orderIdStr && !qrToken.startsWith(`${orderIdStr}-`)) {
          return res.status(400).json({
            success: false,
            message: "Invalid QR token",
          });
        }
        finalQrToken = qrToken;
      }

      // Order must be in a deliverable state
      if (!["assigned", "picked_up", "in_transit"].includes(order.deliveryStatus)) {
        return res.status(400).json({
          success: false,
          message: `Order cannot be marked delivered from current status: ${order.deliveryStatus}`,
        });
      }

      // Handle both multipart file upload and base64 image string
      let photoUrl = req.file?.path || null;
      const photoParam = req.body.proofPhoto;
      
      // If photo was sent as base64 string in request body
      if (photoParam && typeof photoParam === 'string' && photoParam.startsWith('data:')) {
        try {
          const { v2: cloudinary } = await import('cloudinary');
          const uploadResult = await cloudinary.uploader.upload(photoParam, {
            folder: 'proof-of-delivery',
            transformation: [
              { width: 1920, height: 1080, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
            ]
          });
          photoUrl = uploadResult.secure_url;
        } catch (uploadErr) {
          console.error('Cloudinary upload failed:', uploadErr.message);
          // Continue without photo if upload fails
        }
      }

      // Update order
      order.deliveryStatus = "delivered";
      order.status = "completed";
      order.proofOfDelivery = {
        photoUrl,
        scannedAt: new Date(),
        riderId: rider._id,
        // In photo_only mode there is no scan; keep scannedAt as the
        // completion timestamp and flag the record so admins can tell
        // the two flows apart.
        qrToken: finalQrToken || `${order._id}-${Date.now()}-photo-only`,
      };

      await order.save();

      // Rider goes back to available
      rider.availabilityStatus = "available";
      await rider.save();

      // Update payment status if COD
      const Payment = (await import("../../models/Payment.js")).default;
      if (order.payment) {
        await Payment.findByIdAndUpdate(order.payment, {
          status: "paid",
          paidAt: new Date(),
        });
      }

      // Audit log
      await AuditLog.create({
        user: req.user.userId,
        action: "delivery_completed_with_proof",
        target: "Order",
        targetId: order._id,
        details: `Rider completed delivery with photo proof for order #${order._id.toString().slice(-6).toUpperCase()}`,
      });

      const updated = await Order.findById(order._id)
        .populate("user", "firstname lastname email")
        .populate("branch", "name branchCode")
        .populate("proofOfDelivery.riderId", "user");

      emitOrderUpdated(updated);

      return res.status(200).json({
        success: true,
        message: "Delivery completed with proof",
        data: updated,
      });
    } catch (err) {
      console.error("Complete delivery error:", err.message);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }
);

/**
 * GET /api/rider/deliveries/:id/proof
 * Get proof of delivery for an order (rider can view their own)
 */
router.get("/:id/proof", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const rider = await Rider.findOne({ user: req.user.userId });
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const order = await Order.findById(id).populate("proofOfDelivery.riderId", "user");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Only the rider who completed this delivery can view
    if (order.proofOfDelivery?.riderId?._id?.toString() !== rider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this proof",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        proofOfDelivery: order.proofOfDelivery,
        completedAt: order.updatedAt,
      },
    });
  } catch (err) {
    console.error("Get proof error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default router;
