import express from "express";

import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomerById,
  toggleCustomerStatus,
  deleteCustomerById,
} from "../../controllers/admin/customer.controller.js";
import { requireDeleteConfirmation } from "../../middlewares/deleteConfirm.middleware.js";
import { resolveAdminBranch } from "../../middlewares/branchScope.middleware.js";

const router = express.Router();

// Branch scoping: admins manage customers who ordered at their branch only.
router.use(resolveAdminBranch);

// GET    /api/admin/customers
router.get("/", getCustomers);

// POST   /api/admin/customers //note fallback
router.post("/", createCustomer);

// GET    /api/admin/customers/:id
router.get("/:id", getCustomerById);

// PATCH  /api/admin/customers/:id
router.patch("/:id", updateCustomerById);

// PATCH  /api/admin/customers/:id/status
router.patch("/:id/status", toggleCustomerStatus);

// DELETE /api/admin/customers/:id (requires { confirmText: "DELETE" })
router.delete("/:id", requireDeleteConfirmation, deleteCustomerById);

export default router;
