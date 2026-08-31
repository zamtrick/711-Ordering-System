import Branch from "../../models/Branch.js";

// ==========================================
// GET ALL BRANCHES
// ==========================================
export const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find([]).sort({ createdAt: -1 });

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

// ADDED: Get a single branch using its ID
export const getBranchById = async (req, res) => {
  try {
    // ADDED: Get the branch ID from the URL parameter
    const { id } = req.params;

    // ADDED: Find the branch using its MongoDB ID
    const branch = await Branch.findById(id);

    // ADDED: Check if branch does not exist
    if (!branch) {
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    // ADDED: Return the branch
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
    const { name, branchCode, location, city } = req.body;

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
      branchCode,
      location,
      city,
    });

    return res.status(201).json({
      success: true,
      message: "Create Branch Successfully",
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
// UPDATE BRANCH
// ==========================================

// ADDED: Update an existing branch
export const updateBranch = async (req, res) => {
  try {
    // ADDED: Get branch ID from URL
    const { id } = req.params;

    // ADDED: Get updated data from request body
    const { name, branchCode, location, city } = req.body;

    // ADDED: Validate required fields
    if (!name || !branchCode || !location || !city) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // ADDED: Check if another branch is already using this branchCode
    const existBranch = await Branch.findOne({
      branchCode,
      _id: { $ne: id },
    });

    if (existBranch) {
      return res
        .status(409)
        .json({ success: false, message: "Branch Code already exists" });
    }

    // ADDED: Find the branch and update it
    const branch = await Branch.findByIdAndUpdate(
      id,
      {
        name,
        branchCode,
        location,
        city,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    // ADDED: Check if branch was not found
    if (!branch) {
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    // ADDED: Return the updated branch
    return res.status(200).json({
      success: true,
      message: "Branch updated successfully",
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
// DELETE BRANCH
// ==========================================

// ADDED: Delete an existing branch
export const deleteBranch = async (req, res) => {
  try {
    // ADDED: Get branch ID from URL
    const { id } = req.params;

    // ADDED: Find and delete the branch
    const branch = await Branch.findByIdAndDelete(id);

    // ADDED: Check if branch was not found
    if (!branch) {
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    // ADDED: Return success response
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
