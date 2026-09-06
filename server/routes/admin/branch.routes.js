import express from "express";
import { getBranchesForAdmin } from "../../controllers/admin/branch.controller.js";

const router = express.Router();

router.get("/", getBranchesForAdmin);

export default router;
