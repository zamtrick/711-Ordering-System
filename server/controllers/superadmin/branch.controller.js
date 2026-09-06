import Branch from "../../models/Branch.js";
import { logAction } from "./audit.controller.js";

// ==========================================
// GET ALL BRANCHES
// ==========================================
export const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find().sort({ createdAt: -1 });

    if (branches.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No branch created yet!" });
    }

    return res.status(200).json({
      success: true,
      message: "View all branches",
      branches,
    });
  } catch (err) {
    console.error(err.message);

    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// GET BRANCH BY ID
// ==========================================
export const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await Branch.findById(id);

    if (!branch) {
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    return res.status(200).json({
      success: true,
      message: "View branch successfully",
      branch,
    });
  } catch (err) {
    console.error(err.message);

    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// CREATE BRANCH
// ==========================================
export const createBranch = async (req, res) => {
  try {
    const {
      name,
      branchCode,
      location,
      city,
      street,
      barangay,
      province,
      postalCode,
      contactNumber,
      email,
      status,
      openingTime,
      closingTime,
      paymentMethods,
    } = req.body;

    if (!name || !branchCode || !location || !city) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const existBranch = await Branch.findOne({ branchCode });

    if (existBranch) {
      return res
        .status(409)
        .json({ success: false, message: "Branch Code already exists" });
    }

    const branch = await Branch.create({
      name,
      branchCode: branchCode.toUpperCase(),
      location,
      address: { street, barangay, city, province, postalCode },
      contactNumber,
      email,
      status: status ?? "active",
      openingTime,
      closingTime,
      // Empty arrays would fail the schema validator — default to cash
      paymentMethods:
        Array.isArray(paymentMethods) && paymentMethods.length > 0
          ? paymentMethods
          : ["cash"],
    });

    // Audit log
    logAction(req.user.userId, "create_branch", "branch", branch._id, {
      name: branch.name,
      branchCode: branch.branchCode,
      location: branch.location,
    });

    return res.status(201).json({
      success: true,
      message: "Create Branch Successfully",
      branch,
    });
  } catch (err) {
    // Surface validation errors (bad payload) as 400, not 500
    if (err.name === "ValidationError") {
      const msg =
        Object.values(err.errors)[0]?.message ?? "Validation failed";
      return res.status(400).json({ success: false, message: msg });
    }
    console.error(err.message);

    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// UPDATE BRANCH
// ==========================================
export const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      branchCode,
      location,
      city,
      street,
      barangay,
      province,
      postalCode,
      contactNumber,
      email,
      status,
      openingTime,
      closingTime,
      paymentMethods,
    } = req.body;

    if (!name || !branchCode || !location || !city) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const existBranch = await Branch.findOne({
      branchCode: branchCode.toUpperCase(),
      _id: { $ne: id },
    });

    if (existBranch) {
      return res
        .status(409)
        .json({ success: false, message: "Branch Code already exists" });
    }

    const branch = await Branch.findByIdAndUpdate(
      id,
      {
        name,
        branchCode: branchCode.toUpperCase(),
        location,
        address: { street, barangay, city, province, postalCode },
        contactNumber,
        email,
        status,
        openingTime,
        closingTime,
        // Only set when a non-empty array is provided; undefined keeps existing
        paymentMethods:
          Array.isArray(paymentMethods) && paymentMethods.length > 0
            ? paymentMethods
            : undefined,
      },
      { new: true, runValidators: true },
    );

    if (!branch) {
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    // Audit log
    logAction(req.user.userId, "update_branch", "branch", id, {
      name: branch.name,
      branchCode: branch.branchCode,
      status: branch.status,
    });

    return res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      branch,
    });
  } catch (err) {
    // Surface validation errors (bad payload) as 400, not 500
    if (err.name === "ValidationError") {
      const msg =
        Object.values(err.errors)[0]?.message ?? "Validation failed";
      return res.status(400).json({ success: false, message: msg });
    }
    console.error(err.message);

    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// DELETE BRANCH
// ==========================================
export const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    // Get branch info before deleting
    const branch = await Branch.findById(id);

    if (!branch) {
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    const branchName = branch.name;
    const branchCode = branch.branchCode;

    await Branch.findByIdAndDelete(id);

    // Audit log
    logAction(req.user.userId, "delete_branch", "branch", id, {
      name: branchName,
      branchCode,
    });

    return res.status(200).json({
      success: true,
      message: "Branch deleted successfully",
    });
  } catch (err) {
    console.error(err.message);

    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
