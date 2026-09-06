import Branch from "../../models/Branch.js";

// ==========================================
// GET BRANCHES (Admin lookup for forms)
// ==========================================
export const getBranchesForAdmin = async (req, res) => {
  try {
    const branches = await Branch.find().sort({ name: 1 }).select("name branchCode _id");
    return res.status(200).json({ success: true, branches });
  } catch (err) {
    console.error("Admin branch lookup error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
