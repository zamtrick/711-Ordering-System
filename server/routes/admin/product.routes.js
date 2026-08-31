import {
  getProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById,
} from "../../controllers/admin/product.controller.js";
import express from "express";

const router = express.Router();
router.get("/products", getProducts);
router.post("/products", createProduct);
router.get("/products/:id", getProductById);
router.patch("/products/:id", updateProductById);
router.delete("/products/:id", deleteProductById);

export default router;
