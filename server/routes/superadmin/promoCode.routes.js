import express from "express";

import {
  getPromoCodes,
  createPromoCode,
  updatePromoCodeById,
  deletePromoCodeById,
} from "../../controllers/superadmin/promoCode.controller.js";
import { requireDeleteConfirmation } from "../../middlewares/deleteConfirm.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| SUPERADMIN PROMO CODE ROUTES
|--------------------------------------------------------------------------
*/

router.get("/", getPromoCodes);
router.post("/", createPromoCode);
router.patch("/:id", updatePromoCodeById);
router.delete("/:id", requireDeleteConfirmation, deletePromoCodeById);

export default router;
