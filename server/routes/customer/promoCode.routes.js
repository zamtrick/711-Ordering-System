import express from "express";

import { validatePromoCode } from "../../controllers/customer/promoCode.controller.js";
import { promoCodeLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| CUSTOMER PROMO CODE ROUTES
|--------------------------------------------------------------------------
*/

// Preview a promo code before the order exists (checkout screen)
// POST /api/customer/promo-codes/validate  (body: { code, subtotal })
router.post("/validate", promoCodeLimiter, validatePromoCode);

export default router;
