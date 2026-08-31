import Category from "../../models/Category.js";

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
    console.error(err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Delete category by ID
export const deleteCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

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
