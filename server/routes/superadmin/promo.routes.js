import express from "express";
import {
  getPromos,
  createPromo,
  updatePromoById,
  deletePromoById,
  uploadPromoImage,
  deletePromoImage,
} from "../../controllers/superadmin/promo.controller.js";
import { getPromoImageUploader, isCloudinaryConfigured } from "../../utils/uploads.js";
import { requireDeleteConfirmation } from "../../middlewares/deleteConfirm.middleware.js";

const router = express.Router();

router.get("/", getPromos);
router.post("/", createPromo);
router.patch("/:id", updatePromoById);
router.delete("/:id", requireDeleteConfirmation, deletePromoById);

router.post("/:id/image", (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      success: false,
      message:
        "Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env",
    });
  }
  try {
    getPromoImageUploader().single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      uploadPromoImage(req, res);
    });
  } catch (err) {
    return res.status(503).json({ success: false, message: err.message });
  }
});
router.delete("/:id/image", deletePromoImage);

export default router;
