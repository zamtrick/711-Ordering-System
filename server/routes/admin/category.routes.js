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
router.get("/", getCategories);

// Create category
router.post("/", createCategory);

// Get category by ID
router.get("/:id", getCategoryById);

// Update category by ID
router.patch("/:id", updateCategoryById);

// Delete category by ID
router.delete("/:id", deleteCategoryById);

export default router;
