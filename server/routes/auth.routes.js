import express from "express";
import {
  register,
  login,
  logout,
  me,
  requestVerificationCode,
  confirmVerificationCode,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controllers.js";
import auth from "../middlewares/auth.middleware.js";
import {
  authLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.post("/login", authLimiter, login);
router.post("/register", authLimiter, register);
router.post("/logout", logout);
router.get("/me", auth, me);

// Email OTP — request paths are cooldown-capped per email in the OTP
// service plus IP-capped here; confirm paths are attempt-capped there
// plus IP-capped here.
router.post("/verify/request", otpRequestLimiter, requestVerificationCode);
router.post("/verify/confirm", otpVerifyLimiter, confirmVerificationCode);
router.post("/password/forgot", otpRequestLimiter, forgotPassword);
router.post("/password/reset", otpVerifyLimiter, resetPassword);

// Returns the raw JWT so native socket clients can pass it
// in the handshake auth object (httpOnly cookies aren't readable by JS).
router.get("/token", auth, (req, res) => {
  return res.status(200).json({
    success: true,
    token: req.cookies.accessToken,
  });
});

export default router;
