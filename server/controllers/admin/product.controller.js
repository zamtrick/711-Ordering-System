import mongoose from "mongoose";
import Product from "../../models/Product.js";
import XLSX from "xlsx";
import { removeUploadedFile, isCloudinaryConfigured } from "../../utils/uploads.js";

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("categoryId");
    return res.status(200).json({ success: true, message: "View all products", products });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Maps common Mongoose errors to proper 4xx responses instead of a bare 500
const handleProductError = (err, res) => {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ success: false, message: `Product ${field} already exists` });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: Object.values(err.errors)[0]?.message ?? "Invalid product data" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }
  console.error(err.message);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    const product = await Product.findById(id).populate("categoryId");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    return res.status(200).json({ success: true, message: "Product found", product });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { sku, barcode, name, description, categoryId, price, stock } = req.body;
    if (!sku || !barcode || !name || !categoryId || price === undefined || stock === undefined) {
      return res.status(400).json({ success: false, message: "SKU, barcode, name, categoryId, price, and stock are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }
    // Duplicate check first so the client gets a clean 409, not a 500
    const existingSku = await Product.findOne({ sku: String(sku).trim() });
    if (existingSku) {
      return res.status(409).json({ success: false, message: "SKU already exists" });
    }
    const product = await Product.create({ sku, barcode, name, description, categoryId, price, stock });
    return res.status(201).json({ success: true, message: "Product Created Successfully", product });
  } catch (err) {
    return handleProductError(err, res);
  }
};

export const updateProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    const { sku, barcode, name, description, categoryId, price, stock } = req.body;
    if (categoryId !== undefined && !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }
    if (sku !== undefined) {
      const existingSku = await Product.findOne({ sku: String(sku).trim(), _id: { $ne: id } });
      if (existingSku) {
        return res.status(409).json({ success: false, message: "SKU already exists" });
      }
    }
    const product = await Product.findByIdAndUpdate(id, { sku, barcode, name, description, categoryId, price, stock }, { new: true, runValidators: true }).populate("categoryId");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    return res.status(200).json({ success: true, message: "Product Updated Successfully", product });
  } catch (err) {
    return handleProductError(err, res);
  }
};

export const deleteProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Remove the image file stored for this product (if any)
    removeUploadedFile(product.image);

    return res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// UPLOAD / REPLACE PRODUCT IMAGE
// ==========================================
// POST /api/admin/products/:id/image
// multipart/form-data with field "image"
// Images are uploaded straight to Cloudinary via multer-storage-cloudinary;
// the DB stores the full https://res.cloudinary.com/... URL, so every client
// (web admin, customer mobile app) renders it directly — no host rewriting.
export const uploadProductImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }

    const product = await Product.findById(id);
    if (!product) {
      // Remove the just-uploaded orphan asset from Cloudinary
      removeUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Delete the previous image (Cloudinary or legacy local) before replacing it
    removeUploadedFile(product.image);

    // req.file.path is the full Cloudinary delivery URL
    product.image = req.file.path;
    await product.save();

    const updated = await Product.findById(id).populate("categoryId");
    return res.status(200).json({ success: true, message: "Product image uploaded successfully", product: updated });
  } catch (err) {
    console.error("Upload product image error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// REMOVE PRODUCT IMAGE
// ==========================================
// DELETE /api/admin/products/:id/image
export const deleteProductImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    removeUploadedFile(product.image);
    product.image = "";
    await product.save();

    const updated = await Product.findById(id).populate("categoryId");
    return res.status(200).json({ success: true, message: "Product image removed successfully", product: updated });
  } catch (err) {
    console.error("Delete product image error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// IMPORT PRODUCTS FROM EXCEL/CSV
// ==========================================
export const importProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "File is empty" });
    }

    // Expected columns: sku, barcode, name, description, categoryId, price, stock
    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        const sku = String(row.sku || row.SKU || "").trim();
        const barcode = String(row.barcode || row.Barcode || "").trim();
        const name = String(row.name || row.Name || "").trim();
        const description = String(row.description || row.Description || "").trim();
        const categoryId = String(row.categoryId || row.category_id || "").trim();
        const price = Number(row.price || row.Price || 0);
        const stock = Number(row.stock || row.Stock || 0);

        if (!sku || !name) {
          results.skipped++;
          results.errors.push(`Row skipped: missing sku or name`);
          continue;
        }

        // Check if SKU already exists
        const existing = await Product.findOne({ sku });
        if (existing) {
          results.skipped++;
          continue;
        }

        await Product.create({
          sku,
          barcode: barcode || undefined,
          name,
          description: description || undefined,
          categoryId: categoryId || undefined,
          price,
          stock,
        });

        results.created++;
      } catch (rowErr) {
        results.skipped++;
        results.errors.push(`Row error: ${rowErr.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Import complete: ${results.created} created, ${results.skipped} skipped`,
      data: results,
    });
  } catch (err) {
    console.error("Import products error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
