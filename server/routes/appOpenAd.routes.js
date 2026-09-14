import express from "express";
import {
  getActiveAd,
  listAds,
  createAd,
  updateAd,
  deleteAd,
  uploadAdImage,
  deleteAdImage,
} from "../controllers/appOpenAd.controller.js";
import auth from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { requireAdminPermission } from "../middlewares/adminPermissions.middleware.js";
import { getAppOpenAdImageUploader, isCloudinaryConfigured } from "../utils/uploads.js";

const router = express.Router();

// --------------------------------------------------
// Public — customer app fetches the active ad on open
// --------------------------------------------------
router.get("/active", getActiveAd);

// --------------------------------------------------
// Management — superadmins always; branch admins only when the
// superadmin's "Manage Ads" permission toggle is ON
// --------------------------------------------------
router.use(auth, authorize("admin", "superadmin"));

router.get("/", listAds);

// Admins can read but not write when the toggle is off
router.post("/", requireAdminPermission("canManageAds"), createAd);
router.patch("/:id", requireAdminPermission("canManageAds"), updateAd);
router.delete("/:id", requireAdminPermission("canManageAds"), deleteAd);
router.post("/:id/image", requireAdminPermission("canManageAds"), (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      success: false,
      message:
        "Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env",
    });
  }
  try {
    getAppOpenAdImageUploader().single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      uploadAdImage(req, res);
    });
  } catch (err) {
    return res.status(503).json({ success: false, message: err.message });
  }
});
router.delete("/:id/image", requireAdminPermission("canManageAds"), deleteAdImage);

export default router;
