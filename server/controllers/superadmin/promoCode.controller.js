import mongoose from "mongoose";

import PromoCode from "../../models/PromoCode.js";
import { logAction } from "./audit.controller.js";
import { parsePagination, buildPaginationMeta, escapeRegex } from "../../utils/pagination.js";

const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;

// Parse a positive/zero number, or a null to mean "unlimited" / "no limit".
// Returns { error } on failure, or stores the coerced value into `data`.
const parseOptionalNumber = (data, key, value, { label, allowZero = false, integer = false } = {}) => {
  if (value === null || value === undefined || value === "") {
    data[key] = null;
    return null;
  }
  const num = Number(value);
  const valid = Number.isFinite(num) && num >= 0 && (allowZero || num > 0);
  if (!valid) {
    return {
      error: allowZero
        ? `${label} must be 0 or greater`
        : `${label} must be greater than 0`,
    };
  }
  if (integer) {
    // Counts (maxUses, perUserLimit) are whole numbers; a decimal stored here
    // would silently disable the Number.isInteger check in the service.
    if (!Number.isSafeInteger(num)) {
      return { error: `${label} must be a whole number` };
    }
    data[key] = num;
    return null;
  }
  data[key] = Math.round(num * 100) / 100;
  return null;
};

// Validate and normalize an incoming promo code payload.
// Returns { error } on failure, or { data } with coerced values on success.
const parsePromoCodeBody = (body, { partial = false } = {}) => {
  const data = {};

  if (body.code !== undefined) {
    const code = String(body.code ?? "").trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return {
        error:
          "Code must be 3–30 characters using letters, numbers, hyphens or underscores",
      };
    }
    data.code = code;
  } else if (!partial) {
    return { error: "Code is required" };
  }

  if (body.type !== undefined) {
    if (!["percent", "fixed"].includes(body.type)) {
      return { error: "Discount type must be percent or fixed" };
    }
    data.type = body.type;
  } else if (!partial) {
    return { error: "Discount type is required" };
  }

  if (body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return { error: "Discount value must be greater than 0" };
    }
    data.value = value;
  } else if (!partial) {
    return { error: "Discount value is required" };
  }

  // Percent discounts can't exceed 100% — applies to create and update.
  const effectiveType = data.type ?? body.type;
  const effectiveValue = data.value ?? (body.value !== undefined ? Number(body.value) : undefined);
  if (effectiveType === "percent" && Number.isFinite(effectiveValue) && effectiveValue > 100) {
    return { error: "Percentage discount cannot exceed 100" };
  }

  if (body.description !== undefined) {
    data.description = String(body.description ?? "").trim();
  }

  if (body.minOrderAmount !== undefined) {
    const err = parseOptionalNumber(
      data,
      "minOrderAmount",
      body.minOrderAmount,
      { label: "Minimum order amount", allowZero: true },
    );
    if (err) return err;
  }

  if (body.maxDiscount !== undefined) {
    const err = parseOptionalNumber(data, "maxDiscount", body.maxDiscount, {
      label: "Maximum discount",
      allowZero: true,
    });
    if (err) return err;
  }

  if (body.maxUses !== undefined) {
    const err = parseOptionalNumber(data, "maxUses", body.maxUses, {
      label: "Total usage limit",
      integer: true,
    });
    if (err) return err;
  }

  if (body.perUserLimit !== undefined) {
    const err = parseOptionalNumber(data, "perUserLimit", body.perUserLimit, {
      label: "Per-customer usage limit",
      integer: true,
    });
    if (err) return err;
  }

  if (body.startsAt !== undefined) {
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      return { error: "Start date is invalid" };
    }
    data.startsAt = startsAt ?? new Date();
  }

  if (body.endsAt !== undefined) {
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return { error: "End date is invalid" };
    }
    data.endsAt = endsAt;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  // End must come after start when both are known.
  if (data.startsAt && data.endsAt && data.endsAt.getTime() <= data.startsAt.getTime()) {
    return { error: "End date must be after the start date" };
  }

  return { data };
};

// --------------------------------------------------
// LIST PROMO CODES — paginated + searchable by code/description
// GET /api/superadmin/promo-codes?page=1&limit=10&search=save
// --------------------------------------------------

export const getPromoCodes = async (req, res) => {
  try {
    const { page, limit, skip, search, paginated } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 100,
    });

    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ code: rx }, { description: rx }];
    }

    const query = PromoCode.find(filter).sort({ createdAt: -1 });
    if (paginated) query.skip(skip).limit(limit);

    const [promoCodes, total] = await Promise.all([
      query,
      paginated ? PromoCode.countDocuments(filter) : Promise.resolve(0),
    ]);

    const payload = { success: true, promoCodes };
    if (paginated) payload.pagination = buildPaginationMeta(total, page, limit);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Get promo codes error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// CREATE PROMO CODE
// POST /api/superadmin/promo-codes
// --------------------------------------------------

export const createPromoCode = async (req, res) => {
  try {
    const parsed = parsePromoCodeBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const existing = await PromoCode.findOne({ code: parsed.data.code });
    if (existing) {
      return res.status(409).json({ success: false, message: "That code already exists" });
    }

    const promoCode = await PromoCode.create(parsed.data);

    logAction(req.user?.userId, "create_promo_code", "promoCode", promoCode._id, {
      code: promoCode.code,
      type: promoCode.type,
      value: promoCode.value,
    });

    return res.status(201).json({ success: true, message: "Promo code created", promoCode });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "That code already exists" });
    }
    console.error("Create promo code error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// UPDATE PROMO CODE
// PATCH /api/superadmin/promo-codes/:id
// --------------------------------------------------

export const updatePromoCodeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo code ID" });
    }

    const parsed = parsePromoCodeBody(req.body, { partial: true });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    if (parsed.data.code) {
      const clash = await PromoCode.findOne({ code: parsed.data.code, _id: { $ne: id } });
      if (clash) {
        return res.status(409).json({ success: false, message: "That code already exists" });
      }
    }

    const promoCode = await PromoCode.findByIdAndUpdate(id, parsed.data, {
      new: true,
      runValidators: true,
    });
    if (!promoCode) {
      return res.status(404).json({ success: false, message: "Promo code not found" });
    }

    logAction(req.user?.userId, "update_promo_code", "promoCode", promoCode._id, parsed.data);

    return res.status(200).json({ success: true, message: "Promo code updated", promoCode });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "That code already exists" });
    }
    console.error("Update promo code error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// DELETE PROMO CODE
// DELETE /api/superadmin/promo-codes/:id
// --------------------------------------------------

export const deletePromoCodeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo code ID" });
    }

    const promoCode = await PromoCode.findByIdAndDelete(id);
    if (!promoCode) {
      return res.status(404).json({ success: false, message: "Promo code not found" });
    }

    logAction(req.user?.userId, "delete_promo_code", "promoCode", id, {
      code: promoCode.code,
    });

    return res.status(200).json({ success: true, message: "Promo code deleted" });
  } catch (err) {
    console.error("Delete promo code error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
