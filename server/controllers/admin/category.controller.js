import mongoose from "mongoose";
import Category from "../../models/Category.js";

// Maps common Mongoose errors to proper 4xx responses instead of a bare 500
const handleCategoryError = (err, res) => {
  if (err?.code === 11000) {
    return res.status(409).json({ success: false, message: "Category already exists" });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: Object.values(err.errors)[0]?.message ?? "Invalid category data" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid category ID" });
  }
  console.error(err.message);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

// Get all categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      categories,
    });
  } catch (err) {
    console.error(err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Get category by ID
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully",
      category,
    });
  } catch (err) {
    console.error(err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Create category
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if required fields are provided
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ name });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    const category = await Category.create({
      name,
      description,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (err) {
    console.error(err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Update category by ID
export const updateCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Update category and return the updated document
    // Duplicate-name check first so the client gets a clean 409, not a 500
    if (name !== undefined) {
      const existingCategory = await Category.findOne({ name: String(name).trim(), _id: { $ne: id } });
      if (existingCategory) {
        return res.status(409).json({ success: false, message: "Category already exists" });
      }
    }

    const category = await Category.findByIdAndUpdate(
      id,
      {
        name,
        description,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (err) {
    return handleCategoryError(err, res);
  }
};

// Delete category by ID
export const deleteCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    // Find the category and delete it
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      category,
    });
  } catch (err) {
    console.error(err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
