import express from "express";

import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategoryById,
  deleteCategoryById,
} from "../../controllers/admin/category.controller.js";

const router = express.Router();

// Get all categories
router.get("/categories", getCategories);

// Create category
router.post("/categories", createCategory);

// Get category by ID
router.get("/categories/:id", getCategoryById);

// Update category by ID
router.patch("/categories/:id", updateCategoryById);

// Delete category by ID
router.delete("/categories/:id", deleteCategoryById);

export default router;
