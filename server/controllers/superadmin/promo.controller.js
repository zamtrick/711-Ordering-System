import mongoose from "mongoose";
import Promo from "../../models/Promo.js";
import { removeUploadedFile } from "../../utils/uploads.js";

export const getPromos = async (req, res) => {
  try {
    const promos = await Promo.find().sort({ sortOrder: 1, createdAt: -1 });
    return res.status(200).json({ success: true, promos });
  } catch (err) {
    console.error("Get promos error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const createPromo = async (req, res) => {
  try {
    const { title, subtitle, isActive, sortOrder } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    const promo = await Promo.create({
      title: title.trim(),
      subtitle: subtitle?.trim() ?? "",
      isActive: isActive ?? true,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    });
    return res.status(201).json({ success: true, message: "Promo created", promo });
  } catch (err) {
    console.error("Create promo error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const updatePromoById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo ID" });
    }
    const { title, subtitle, isActive, sortOrder } = req.body;
    const update = {};
    if (title !== undefined) update.title = String(title).trim();
    if (subtitle !== undefined) update.subtitle = String(subtitle).trim();
    if (isActive !== undefined) update.isActive = Boolean(isActive);
    if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
      update.sortOrder = Number(sortOrder);
    }
    if (update.title !== undefined && !update.title) {
      return res.status(400).json({ success: false, message: "Title cannot be empty" });
    }
    const promo = await Promo.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!promo) {
      return res.status(404).json({ success: false, message: "Promo not found" });
    }
    return res.status(200).json({ success: true, message: "Promo updated", promo });
  } catch (err) {
    console.error("Update promo error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const deletePromoById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo ID" });
    }
    const promo = await Promo.findByIdAndDelete(id);
    if (!promo) {
      return res.status(404).json({ success: false, message: "Promo not found" });
    }
    removeUploadedFile(promo.image);
    return res.status(200).json({ success: true, message: "Promo deleted" });
  } catch (err) {
    console.error("Delete promo error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const uploadPromoImage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo ID" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }
    const promo = await Promo.findById(id);
    if (!promo) {
      removeUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: "Promo not found" });
    }
    removeUploadedFile(promo.image);
    promo.image = req.file.path;
    await promo.save();
    return res.status(200).json({ success: true, message: "Promo image uploaded", promo });
  } catch (err) {
    console.error("Upload promo image error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const deletePromoImage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo ID" });
    }
    const promo = await Promo.findById(id);
    if (!promo) {
      return res.status(404).json({ success: false, message: "Promo not found" });
    }
    removeUploadedFile(promo.image);
    promo.image = "";
    await promo.save();
    return res.status(200).json({ success: true, message: "Promo image removed", promo });
  } catch (err) {
    console.error("Delete promo image error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
