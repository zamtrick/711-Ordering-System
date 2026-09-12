import mongoose from "mongoose";
import Admin from "../models/Admin.js";

// --------------------------------------------------
// BRANCH SCOPING
// --------------------------------------------------
// Admins are bound to the branch they are assigned to (Admin.assignedBranch).
// Every /api/admin route passes through resolveAdminBranch, which:
//   - superadmin → req.adminBranchId = null (sees and manages everything)
//   - admin      → req.adminBranchId = their assigned branch ObjectId
//
// Controllers use req.adminBranchId to narrow their queries (branchQuery /
// canAccessBranchDoc helpers), and requireBranchAccess guards routes that
// address a specific :branchId.
// --------------------------------------------------

// Variant of resolveAdminBranch that never rejects customers — it simply
// passes them through (req.adminBranchId stays undefined). Staff get the
// same treatment as resolveAdminBranch. Use on routes shared by customers
// and staff (e.g. chat) where a 403 for "no branch" must not hit customers.
export const resolveStaffBranch = async (req, res, next) => {
  try {
    if (req.user.role === "customer") return next();
    return resolveAdminBranch(req, res, next);
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const resolveAdminBranch = async (req, res, next) => {
  try {
    // Superadmin manages all branches
    if (req.user.role === "superadmin") {
      req.adminBranchId = null;
      return next();
    }

    const admin = await Admin.findOne({ user: req.user.userId }).select(
      "assignedBranch",
    );

    if (!admin || !admin.assignedBranch) {
      return res.status(403).json({
        success: false,
        message: "No branch assigned to this admin account.",
      });
    }

    req.adminBranchId = admin.assignedBranch;
    return next();
  } catch (err) {
    console.error("Resolve admin branch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Guard for routes that address a branch directly (/something/:branchId/...).
// Must run AFTER resolveAdminBranch. Superadmins pass; admins may only
// touch their own branch.
export const requireBranchAccess = (req, res, next) => {
  if (req.user.role === "superadmin") return next();

  const requested = req.params.branchId ?? req.params.id ?? req.params.branch;

  if (!requested || !mongoose.Types.ObjectId.isValid(requested)) {
    return res.status(400).json({ success: false, message: "Invalid branch ID" });
  }

  if (requested !== req.adminBranchId?.toString()) {
    return res.status(403).json({
      success: false,
      message: "You can only manage your assigned branch.",
    });
  }

  return next();
};

// True when the requester is branch-bound (a regular admin).
export const isBranchScoped = (req) =>
  req.user?.role !== "superadmin" && Boolean(req.adminBranchId);

// Query filter helpers. Superadmins pass no filter (see everything);
// admins get an extra condition narrowing results to their branch.
// Pass the field name used by each model, e.g. "branch" (Order) or
// "assignedBranch" (Rider, Admin).
export const branchQuery = (req, field = "branch") => {
  if (req.user?.role === "superadmin" || !req.adminBranchId) return {};
  return { [field]: req.adminBranchId };
};

// Check that a document's branch field matches the requester's assigned
// branch. Superadmins always pass. Accepts a raw ObjectId or a populated
// branch document. Returns true when access is allowed.
export const canAccessBranchDoc = (req, docBranch) => {
  if (req.user?.role === "superadmin" || !req.adminBranchId) return true;
  if (!docBranch) return false;
  const id = docBranch._id ?? docBranch;
  return id.toString() === req.adminBranchId.toString();
};
