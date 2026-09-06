import express from "express";
import { getMyProfile, updateMyProfile } from "../../controllers/admin/profile.controller.js";

const router = express.Router();

router.get("/me", getMyProfile);
router.patch("/me", updateMyProfile);

export default router;
