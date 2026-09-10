import mongoose from "mongoose";

/**
 * BranchProduct — per-branch inventory record.
 *
 * Each document ties one Product to one Branch and tracks:
 *   - isAvailable : whether this product is offered at that branch
 *   - stock       : branch-local stock count (overrides the global product stock
 *                   when this record exists; falls back to product.stock if not)
 *
 * A missing record means the product has not been configured for that branch
 * yet — the customer product route treats it as unavailable unless the admin
 * explicitly creates one.
 */
const branchProductSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Whether this product is visible / orderable at this branch
    isAvailable: {
      type: Boolean,
      default: true,
    },

    // Branch-local stock override.
    // null  → use the global product.stock value
    // >= 0  → use this value instead
    stock: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { timestamps: true },
);

// One record per branch+product pair
branchProductSchema.index({ branch: 1, product: 1 }, { unique: true });
// Speed up "all available products for a branch" lookups
branchProductSchema.index({ branch: 1, isAvailable: 1 });

const BranchProduct = mongoose.model("BranchProduct", branchProductSchema);

export default BranchProduct;
