import express from "express";
import {
  getAdmins,
  createAdmin,
  getAdminById,
  deleteAdminById,
  updateAdminById,
} from "../../controllers/superadmin/admin.controller.js";

const router = express.Router();

router.get("/admins", getAdmins);
router.post("/admins", createAdmin);
router.get("/admins/:id", getAdminById);
router.patch("/admins/:id", updateAdminById);
router.delete("/admins/:id", deleteAdminById);

export default router;
