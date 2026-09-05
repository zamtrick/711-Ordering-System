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
import { productImageUpload } from "../../utils/uploads.js";

// In-memory storage for the CSV/Excel product import
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();
router.get("/", getProducts);
router.post("/", createProduct);
router.post("/import", upload.single("file"), importProducts);
router.get("/:id", getProductById);
router.patch("/:id", updateProductById);
router.delete("/:id", deleteProductById);

// Product image upload/removal (disk storage under /uploads/products)
// Wrap upload.single so multer errors (wrong type, too large) return JSON.
router.post("/:id/image", (req, res) => {
  productImageUpload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    uploadProductImage(req, res);
  });
});
router.delete("/:id/image", deleteProductImage);

export default router;
