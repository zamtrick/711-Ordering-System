import express from "express";
import multer from "multer";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategoryById,
  deleteCategoryById,
  uploadCategoryImage,
  deleteCategoryImage,
} from "../../controllers/admin/category.controller.js";
import { getCategoryImageUploader, isCloudinaryConfigured } from "../../utils/uploads.js";
import { requireAdminPermission } from "../../middlewares/adminPermissions.middleware.js";
import { requireDeleteConfirmation } from "../../middlewares/deleteConfirm.middleware.js";

const router = express.Router();

// Get all categories
router.get("/", getCategories);

// Create category
router.post("/", requireAdminPermission("canManageCategories"), createCategory);

// Get category by ID
router.get("/:id", getCategoryById);

// Update category by ID
router.patch("/:id", requireAdminPermission("canManageCategories"), updateCategoryById);

// Delete category by ID (requires { confirmText: "DELETE" })
router.delete(
  "/:id",
  requireAdminPermission("canManageCategories"),
  requireDeleteConfirmation,
  deleteCategoryById
);

// Category image upload/removal — stored on Cloudinary.
// The uploader is created lazily on first request (env vars must be loaded
// first) and a missing config returns a clear 503 instead of a crash.
router.post("/:id/image", requireAdminPermission("canManageCategories"), (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      success: false,
      message:
        "Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env",
    });
  }

  try {
    getCategoryImageUploader().single("image")(
      req,
      res,
      (err) => {
        if (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
        uploadCategoryImage(req, res);
      }
    );
  } catch (err) {
    return res.status(503).json({ success: false, message: err.message });
  }
});
router.delete("/:id/image", requireAdminPermission("canManageCategories"), deleteCategoryImage);

export default router;
