import express from "express";
import {
  getBranches,
  getBranchById,
  createBranch,
  deleteBranch,
  updateBranch,
} from "../../controllers/superadmin/branch.controller.js";

const router = express.Router();

router.get("/branches", getBranches);
router.post("/branches", createBranch);
router.get("/branches/:id", getBranchById);
router.delete("/branches/:id", deleteBranch);
router.patch("/branches/:id", updateBranch);

export default router;
