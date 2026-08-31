import express from "express";
import {
  getBranches,
  getBranchById,
  createBranch,
  deleteBranch,
  updateBranch,
} from "../../controllers/superadmin/branch.controller.js";

const router = express.Router();

router.get("/", getBranches);
router.post("/", createBranch);
router.get("/:id", getBranchById);
router.delete("/:id", deleteBranch);
router.patch("/:id", updateBranch);

export default router;
