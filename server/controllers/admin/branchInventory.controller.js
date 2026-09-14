import mongoose from "mongoose";
import BranchProduct from "../../models/BranchProduct.js";
import Product from "../../models/Product.js";
import Branch from "../../models/Branch.js";
import Category from "../../models/Category.js";
import { parsePagination, buildPaginationMeta, escapeRegex } from "../../utils/pagination.js";

// --------------------------------------------------
// GET INVENTORY FOR A BRANCH
// GET /api/admin/branch-inventory/:branchId
//
// Returns every active product with its BranchProduct record merged in.
// Products not yet configured for this branch get a synthetic record
// (isAvailable: false, stock: null) so the admin UI can show them too.
// --------------------------------------------------
export const getBranchInventory = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ success: false, message: "Invalid branch ID" });
    }

    const branch = await Branch.findById(branchId).select("name branchCode");
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    const { page, limit, skip, search, paginated } = parsePagination(req);

    // Active products, narrowed by the optional server-side search over
    // product name / SKU / category name.
    let productQuery = { isActive: true };
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      const matchingCategories = await Category.find({ name: searchRegex })
        .select("_id")
        .lean();
      productQuery = {
        isActive: true,
        $or: [
          { name: searchRegex },
          { sku: searchRegex },
          ...(matchingCategories.length > 0
            ? [{ categoryId: { $in: matchingCategories.map((c) => c._id) } }]
            : []),
        ],
      };
    }

    const total = await Product.countDocuments(productQuery);

    // All active products
    const products = await Product.find(productQuery)
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .skip(paginated ? skip : 0)
      .limit(paginated ? limit : 0)
      .lean();

    // All existing records for this branch
    const records = await BranchProduct.find({ branch: branchId }).lean();
    const recordMap = new Map(records.map((r) => [r.product.toString(), r]));

    const inventory = products.map((p) => {
      const record = recordMap.get(p._id.toString());
      return {
        product: p,
        branchProductId: record?._id ?? null,
        isAvailable: record?.isAvailable ?? false,
        stock: record?.stock ?? null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        branch,
        inventory,
        ...(paginated
          ? { pagination: buildPaginationMeta(total, page, limit) }
          : {}),
      },
    });
  } catch (err) {
    console.error("Get branch inventory error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// UPSERT A SINGLE PRODUCT IN A BRANCH
// PUT /api/admin/branch-inventory/:branchId/products/:productId
//
// Body: { isAvailable: boolean, stock: number | null }
// Creates the BranchProduct record if it doesn't exist, updates if it does.
// --------------------------------------------------
export const upsertBranchProduct = async (req, res) => {
  try {
    const { branchId, productId } = req.params;
    const { isAvailable, stock } = req.body;

    if (!mongoose.Types.ObjectId.isValid(branchId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid branch or product ID" });
    }

    const [branch, product] = await Promise.all([
      Branch.findById(branchId),
      Product.findById(productId),
    ]);

    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const stockValue =
      stock === null || stock === undefined
        ? null
        : Math.max(0, Math.floor(Number(stock)));

    const record = await BranchProduct.findOneAndUpdate(
      { branch: branchId, product: productId },
      {
        isAvailable: Boolean(isAvailable),
        stock: Number.isFinite(stockValue) ? stockValue : null,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return res.status(200).json({
      success: true,
      message: "Branch inventory updated",
      data: record,
    });
  } catch (err) {
    console.error("Upsert branch product error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// BULK UPSERT — toggle availability for multiple products at once
// PATCH /api/admin/branch-inventory/:branchId/bulk
//
// Body: { updates: [{ productId, isAvailable, stock }] }
// --------------------------------------------------
export const bulkUpsertBranchInventory = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { updates } = req.body;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ success: false, message: "Invalid branch ID" });
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: "updates array is required" });
    }

    if (updates.length > 100) {
      return res.status(400).json({ success: false, message: "Too many updates (max 100)" });
    }

    for (const u of updates) {
      if (!u || !mongoose.Types.ObjectId.isValid(u.productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID in updates" });
      }
      if (u.stock !== null && u.stock !== undefined) {
        const n = Number(u.stock);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ success: false, message: "Stock must be a number >= 0" });
        }
      }
    }

    const productIds = updates.map((u) => u.productId);
    const existingCount = await Product.countDocuments({ _id: { $in: productIds } });
    if (existingCount !== productIds.length) {
      return res.status(404).json({ success: false, message: "One or more products not found" });
    }

    const ops = updates.map(({ productId, isAvailable, stock }) => ({
      updateOne: {
        filter: { branch: branchId, product: productId },
        update: {
          $set: {
            isAvailable: Boolean(isAvailable),
            stock:
              stock === null || stock === undefined
                ? null
                : Math.max(0, Math.floor(Number(stock))),
          },
        },
        upsert: true,
      },
    }));

    await BranchProduct.bulkWrite(ops);

    return res.status(200).json({
      success: true,
      message: `${ops.length} record(s) updated`,
    });
  } catch (err) {
    console.error("Bulk upsert branch inventory error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
