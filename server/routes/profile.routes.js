import {
  getMyProfile,
  updateMyProfile,
} from "../controllers/customer/profile.controller.js";
import express from "express";

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Customer profile router is working",
  });
});

router.get("/me", getMyProfile);
router.patch("/me", updateMyProfile);

export default router;
