import mongoose from "mongoose";
import AppOpenAd from "../models/AppOpenAd.js";
import { removeUploadedFile } from "../utils/uploads.js";
import { logAction } from "./superadmin/audit.controller.js";

// --------------------------------------------------
// GET ACTIVE AD (public — customer app calls this on open)
// GET /api/app-open-ad/active
// --------------------------------------------------
// Returns the newest enabled campaign whose schedule window contains now
// and which has a creative uploaded. Responds { data: { ad: null } } when
// nothing qualifies — the app just skips the ad in that case.
// --------------------------------------------------

export const getActiveAd = async (req, res) => {
  try {
    const now = new Date();

    const ad = await AppOpenAd.findOne({
      enabled: true,
      imageUrl: { $ne: null },
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, data: { ad: ad ?? null } });
  } catch (err) {
    console.error("Get active ad error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// LIST ALL CAMPAIGNS (superadmin + permitted admins)
// GET /api/app-open-ad
// --------------------------------------------------

export const listAds = async (req, res) => {
  try {
    const ads = await AppOpenAd.find({}).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: ads });
  } catch (err) {
    console.error("List ads error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// Shared validation for create/update bodies
// --------------------------------------------------

const validateAdBody = (body) => {
  const errors = [];
  const out = {};

  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) errors.push("Title is required");
    else if (t.length > 80) errors.push("Title must be 80 characters or fewer");
    else out.title = t;
  }

  if (body.subtitle !== undefined) {
    const s = String(body.subtitle).trim();
    if (s.length > 140) errors.push("Subtitle must be 140 characters or fewer");
    else out.subtitle = s;
  }

  if (body.ctaLabel !== undefined) {
    const l = String(body.ctaLabel).trim();
    if (l.length > 24) errors.push("CTA label must be 24 characters or fewer");
    else out.ctaLabel = l;
  }

  if (body.ctaUrl !== undefined) {
    const u = String(body.ctaUrl).trim();
    if (u.length > 500) errors.push("CTA URL must be 500 characters or fewer");
    else out.ctaUrl = u;
  }

  if (body.enabled !== undefined) out.enabled = Boolean(body.enabled);

  // Schedule: null or ISO date string
  for (const key of ["startsAt", "endsAt"]) {
    if (body[key] !== undefined) {
      if (body[key] === null || body[key] === "") {
        out[key] = null;
      } else {
        const d = new Date(body[key]);
        if (Number.isNaN(d.getTime())) {
          errors.push(`${key === "startsAt" ? "Start" : "End"} date is invalid`);
        } else {
          out[key] = d;
        }
      }
    }
  }

  return { errors, out };
};

// --------------------------------------------------
// CREATE CAMPAIGN
// POST /api/app-open-ad
// Body: { title, subtitle?, ctaLabel?, ctaUrl?, enabled?, startsAt?, endsAt? }
// --------------------------------------------------

export const createAd = async (req, res) => {
  try {
    const { errors, out } = validateAdBody(req.body ?? {});

    if (!out.title) errors.push("Title is required");
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(". ") });
    }

    const ad = await AppOpenAd.create({
      ...out,
      updatedBy: req.user?.userId ?? null,
    });

    logAction(req.user?.userId, "create_app_open_ad", "AppOpenAd", ad._id, {
      title: ad.title,
    }).catch(() => {});

    return res.status(201).json({ success: true, message: "Ad campaign created", data: ad });
  } catch (err) {
    console.error("Create ad error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// UPDATE CAMPAIGN
// PATCH /api/app-open-ad/:id
// --------------------------------------------------

export const updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ad ID" });
    }

    const { errors, out } = validateAdBody(req.body ?? {});
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(". ") });
    }

    const ad = await AppOpenAd.findByIdAndUpdate(
      id,
      { ...out, updatedBy: req.user?.userId ?? null },
      { new: true, runValidators: true },
    );

    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad campaign not found" });
    }

    logAction(req.user?.userId, "update_app_open_ad", "AppOpenAd", ad._id, out).catch(
      () => {},
    );

    return res.status(200).json({ success: true, message: "Ad campaign updated", data: ad });
  } catch (err) {
    console.error("Update ad error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// DELETE CAMPAIGN (also removes the creative from storage)
// DELETE /api/app-open-ad/:id
// --------------------------------------------------

export const deleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ad ID" });
    }

    const ad = await AppOpenAd.findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad campaign not found" });
    }

    if (ad.imageUrl) removeUploadedFile(ad.imageUrl);
    await ad.deleteOne();

    logAction(req.user?.userId, "delete_app_open_ad", "AppOpenAd", id, {
      title: ad.title,
    }).catch(() => {});

    return res.status(200).json({ success: true, message: "Ad campaign deleted" });
  } catch (err) {
    console.error("Delete ad error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// UPLOAD CREATIVE IMAGE
// POST /api/app-open-ad/:id/image   (multipart field: "image")
// --------------------------------------------------

export const uploadAdImage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ad ID" });
    }
    if (!req.file?.path) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const ad = await AppOpenAd.findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad campaign not found" });
    }

    // Replace the old creative (best-effort cleanup of the previous file)
    const previous = ad.imageUrl;
    ad.imageUrl = req.file.path;
    ad.updatedBy = req.user?.userId ?? null;
    await ad.save();

    if (previous) removeUploadedFile(previous);

    logAction(req.user?.userId, "upload_app_open_ad_image", "AppOpenAd", ad._id, {}).catch(
      () => {},
    );

    return res.status(200).json({ success: true, message: "Image uploaded", data: ad });
  } catch (err) {
    console.error("Upload ad image error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --------------------------------------------------
// REMOVE CREATIVE IMAGE
// DELETE /api/app-open-ad/:id/image
// --------------------------------------------------

export const deleteAdImage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ad ID" });
    }

    const ad = await AppOpenAd.findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad campaign not found" });
    }
    if (!ad.imageUrl) {
      return res.status(400).json({ success: false, message: "No image to remove" });
    }

    removeUploadedFile(ad.imageUrl);
    ad.imageUrl = null;
    ad.updatedBy = req.user?.userId ?? null;
    await ad.save();

    return res.status(200).json({ success: true, message: "Image removed", data: ad });
  } catch (err) {
    console.error("Delete ad image error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
