import express from "express";
import {
  getAdmins,
  createAdmin,
  getAdminById,
  deleteAdminById,
  updateAdminById,
} from "../../controllers/superadmin/admin.controller.js";

const router = express.Router();

router.get("/", getAdmins);
router.post("/", createAdmin);
router.get("/:id", getAdminById);
router.patch("/:id", updateAdminById);
router.delete("/:id", deleteAdminById);

export default router;
