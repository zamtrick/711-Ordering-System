import mongoose from "mongoose";
import Product from "../../models/Product.js";
import BranchProduct from "../../models/BranchProduct.js";
import XLSX from "xlsx";
import { removeUploadedFile, isCloudinaryConfigured } from "../../utils/uploads.js";
import {
  branchQuery,
  isBranchScoped,
} from "../../middlewares/branchScope.middleware.js";

// --------------------------------------------------
// PRODUCT CATALOGUE + BRANCH STOCK SEPARATION
// --------------------------------------------------
// The Product collection is the chain-wide catalogue. Branch-specific data
// (availability + stock) lives in BranchProduct, managed through the
// Branch Inventory screen.
//
//   Regular admin  → GETs return the catalogue MERGED with their branch's
//                    availability/stock (stock column shows branch stock);
//                    writes (create/update/delete/import) are superadmin-only
//                    because the catalogue is global — enforced here in the
//                    controller, independent of route middleware.
//   Superadmin     → GETs return the plain global catalogue and writes pass.
// --------------------------------------------------

const SUPERADMIN_ONLY_MESSAGE =
  "The product catalogue is managed by the superadmin. Use Branch Inventory to manage your branch's availability and stock.";

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

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("categoryId");

    // Branch admins get the catalogue merged with their branch inventory:
    //   - stock shows the branch-local value (falls back to global)
    //   - unavailable-at-branch products are flagged so the UI can grey them
    if (isBranchScoped(req)) {
      const records = await BranchProduct.find({
        branch: req.adminBranchId,
      }).lean();
      const recordMap = new Map(records.map((r) => [r.product.toString(), r]));

      const merged = products.map((p) => {
        const record = recordMap.get(p._id.toString());
        return {
          ...p.toObject(),
          branchStock: record?.stock ?? null,
          isAvailableAtBranch: record?.isAvailable ?? false,
          configuredAtBranch: Boolean(record),
        };
      });

      return res.status(200).json({
        success: true,
        message: "View all products",
        products: merged,
      });
    }

    return res.status(200).json({ success: true, message: "View all products", products });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
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

// --------------------------------------------------
// WRITES — superadmin only (the catalogue is chain-wide)
// --------------------------------------------------

export const createProduct = async (req, res) => {
  if (isBranchScoped(req)) {
    return res.status(403).json({ success: false, message: SUPERADMIN_ONLY_MESSAGE });
  }
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
  if (isBranchScoped(req)) {
    return res.status(403).json({ success: false, message: SUPERADMIN_ONLY_MESSAGE });
  }
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
  if (isBranchScoped(req)) {
    return res.status(403).json({ success: false, message: SUPERADMIN_ONLY_MESSAGE });
  }
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

export const uploadProductImage = async (req, res) => {
  if (isBranchScoped(req)) {
    return res.status(403).json({ success: false, message: SUPERADMIN_ONLY_MESSAGE });
  }
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

export const deleteProductImage = async (req, res) => {
  if (isBranchScoped(req)) {
    return res.status(403).json({ success: false, message: SUPERADMIN_ONLY_MESSAGE });
  }
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

export const importProducts = async (req, res) => {
  if (isBranchScoped(req)) {
    return res.status(403).json({ success: false, message: SUPERADMIN_ONLY_MESSAGE });
  }
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
