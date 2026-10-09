import express from "express";

import {
  listLoyaltyMembers,
  getLoyaltyMember,
  adjustLoyaltyPoints,
} from "../../controllers/admin/loyalty.controller.js";

const router = express.Router();

// List loyalty members (points balances + tiers)
// GET /api/admin/loyalty/members
router.get("/members", listLoyaltyMembers);

// One member with their points history
// GET /api/admin/loyalty/members/:id
router.get("/members/:id", getLoyaltyMember);

// Manual points correction
// POST /api/admin/loyalty/members/:id/adjust  (body: { points, reason })
router.post("/members/:id/adjust", adjustLoyaltyPoints);

export default router;
