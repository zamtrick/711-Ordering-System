import {
  getProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById,
} from "../../controllers/admin/product.controller.js";
import express from "express";

const router = express.Router();
router.get("/", getProducts);
router.post("/", createProduct);
router.get("/:id", getProductById);
router.patch("/:id", updateProductById);
router.delete("/:id", deleteProductById);

export default router;
