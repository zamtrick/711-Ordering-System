import mongoose from "mongoose";

import LoyaltyAccount from "../../models/LoyaltyAccount.js";
import LoyaltyTransaction from "../../models/LoyaltyTransaction.js";
import User from "../../models/User.js";
import { getTierForPoints } from "../../services/loyalty.service.js";

// --------------------------------------------------
// LIST LOYALTY MEMBERS
// GET /api/admin/loyalty/members?search=&page=1&limit=20
// --------------------------------------------------

export const listLoyaltyMembers = async (req, res) => {
  try {
    const pageParam = Number(req.query.page);
    const limitParam = Number(req.query.limit);
    const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam >= 1
        ? Math.min(Math.floor(limitParam), 50)
        : 20;

    const search = String(req.query.search ?? "").trim();
    const sort = String(req.query.sort ?? "points");

    const sortMap = {
      points: { points: -1 },
      earned: { lifetimeEarned: -1 },
      recent: { updatedAt: -1 },
    };

    // Resolve the search term to matching customers first so the name/email
    // filter is applied before pagination — otherwise the total and page
    // count would ignore the search and matches on later pages would be lost.
    const query = {};
    if (search) {
      // Escape regex metacharacters so the term is matched literally.
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingUsers = await User.find({
        $or: [{ firstname: rx }, { lastname: rx }, { email: rx }],
      }).select("_id");
      query.customer = { $in: matchingUsers.map((u) => u._id) };
    }

    const [accounts, total] = await Promise.all([
      LoyaltyAccount.find(query)
        .populate("customer", "firstname lastname email")
        .sort(sortMap[sort] ?? sortMap.points)
        .skip((page - 1) * limit)
        .limit(limit),
      LoyaltyAccount.countDocuments(query),
    ]);

    const data = accounts.map((a) => ({
      _id: a._id,
      customer: a.customer,
      points: a.points,
      lifetimeEarned: a.lifetimeEarned,
      lifetimeRedeemed: a.lifetimeRedeemed,
      tier: getTierForPoints(a.lifetimeEarned).name,
      updatedAt: a.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasMore: page * limit < total,
      },
    });
  } catch (err) {
    console.error("List loyalty members error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// GET ONE MEMBER + HISTORY
// GET /api/admin/loyalty/members/:id
// --------------------------------------------------

export const getLoyaltyMember = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid member ID" });
    }

    const account = await LoyaltyAccount.findById(id).populate(
      "customer",
      "firstname lastname email",
    );
    if (!account) {
      return res.status(404).json({ success: false, message: "Loyalty account not found" });
    }

    const transactions = await LoyaltyTransaction.find({ customer: account.customer._id })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      data: {
        _id: account._id,
        customer: account.customer,
        points: account.points,
        lifetimeEarned: account.lifetimeEarned,
        lifetimeRedeemed: account.lifetimeRedeemed,
        tier: getTierForPoints(account.lifetimeEarned),
        transactions,
      },
    });
  } catch (err) {
    console.error("Get loyalty member error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// MANUAL ADJUST
// POST /api/admin/loyalty/members/:id/adjust  (body: { points, reason })
// --------------------------------------------------

export const adjustLoyaltyPoints = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid member ID" });
    }

    const delta = Math.floor(Number(req.body?.points));
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({
        success: false,
        message: "points must be a non-zero whole number",
      });
    }

    const reason = String(req.body?.reason ?? "").trim();

    // For debits, guard so the balance can never go negative.
    const filter = { _id: id };
    if (delta < 0) filter.points = { $gte: Math.abs(delta) };

    const account = await LoyaltyAccount.findOneAndUpdate(
      filter,
      {
        $inc: {
          points: delta,
          ...(delta > 0
            ? { lifetimeEarned: delta }
            : { lifetimeRedeemed: Math.abs(delta) }),
        },
      },
      { new: true },
    ).populate("customer", "firstname lastname email");

    if (!account) {
      return res.status(400).json({
        success: false,
        message: "Adjustment failed — account not found or balance too low",
      });
    }

    await LoyaltyTransaction.create({
      customer: account.customer._id,
      type: "adjust",
      points: delta,
      reason: reason || `Manual adjustment by admin`,
      balanceAfter: account.points,
      createdBy: req.user?.userId ?? null,
    });

    return res.status(200).json({
      success: true,
      message: `Points adjusted by ${delta > 0 ? "+" : ""}${delta}`,
      data: {
        _id: account._id,
        customer: account.customer,
        points: account.points,
        lifetimeEarned: account.lifetimeEarned,
        lifetimeRedeemed: account.lifetimeRedeemed,
      },
    });
  } catch (err) {
    console.error("Adjust loyalty points error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
