import Product from "../../models/Product.js";

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("categoryId");

    return res
      .status(200)
      .json({ success: true, message: "View all products", products });
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).populate("categoryId");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Product found",
      product,
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: true, message: "Internal Server Error" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { sku, barcode, name, description, categoryId, price, stock } =
      req.body;

    if (
      !sku ||
      !barcode ||
      !name ||
      !categoryId ||
      price === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "SKU, barcode, name, categoryId, price, and stock are required",
      });
    }

    const product = await Product.create({
      sku,
      barcode,
      name,
      description,
      categoryId,
      price,
      stock,
    });

    return res.status(201).json({
      success: true,
      message: "Product Created Successfully",
      product,
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: true, message: "Internal Server Error" });
  }
};

export const updateProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, barcode, name, description, categoryId, price, stock } =
      req.body;

    const product = await Product.findByIdAndUpdate(
      id,
      {
        sku,
        barcode,
        name,
        description,
        categoryId,
        price,
        stock,
      },
      { new: true, runValidators: true },
    ).populate("categoryId");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Product Updated Successfully",
      product,
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const deleteProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      product,
    });
  } catch (err) {
    console.error(err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
