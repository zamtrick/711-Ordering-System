import {
  getProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById,
  importProducts,
  uploadProductImage,
  deleteProductImage,
} from "../../controllers/admin/product.controller.js";
import express from "express";
import multer from "multer";
import { getProductImageUploader, isCloudinaryConfigured } from "../../utils/uploads.js";
import { requireAdminPermission } from "../../middlewares/adminPermissions.middleware.js";
import { requireDeleteConfirmation } from "../../middlewares/deleteConfirm.middleware.js";

// In-memory storage for the CSV/Excel product import
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();
router.get("/", getProducts);
router.post("/", requireAdminPermission("canManageProducts"), createProduct);
router.post("/import", upload.single("file"), requireAdminPermission("canManageProducts"), importProducts);
router.get("/:id", getProductById);
router.patch("/:id", requireAdminPermission("canManageProducts"), updateProductById);
router.delete(
  "/:id",
  requireAdminPermission("canManageProducts"),
  requireDeleteConfirmation,
  deleteProductById
);

// Product image upload/removal — stored on Cloudinary.
// The uploader is created lazily on first request (env vars must be loaded
// first) and a missing config returns a clear 503 instead of a crash.
router.post("/:id/image", requireAdminPermission("canManageProducts"), (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      success: false,
      message:
        "Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env",
    });
  }

  try {
    getProductImageUploader().single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      uploadProductImage(req, res);
    });
  } catch (err) {
    return res.status(503).json({ success: false, message: err.message });
  }
});
router.delete("/:id/image", requireAdminPermission("canManageProducts"), deleteProductImage);

export default router;
