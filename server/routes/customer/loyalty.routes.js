import express from "express";

import {
  getMyLoyalty,
  getMyLoyaltyHistory,
} from "../../controllers/customer/loyalty.controller.js";

const router = express.Router();

// Loyalty summary for the logged-in customer (points, tier, programme rules)
// GET /api/customer/loyalty
router.get("/", getMyLoyalty);

// Paginated points history (earn / redeem / adjust / reverse)
// GET /api/customer/loyalty/transactions
router.get("/transactions", getMyLoyaltyHistory);

export default router;
