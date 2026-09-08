import {
  getMyProfile,
  updateMyProfile,
  addAddress,
  updateAddress,
  removeAddress,
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
router.post("/me/addresses", addAddress);
router.patch("/me/addresses/:addressId", updateAddress);
router.delete("/me/addresses/:addressId", removeAddress);

export default router;
