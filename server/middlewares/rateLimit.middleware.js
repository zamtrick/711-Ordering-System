import rateLimit from "express-rate-limit";

// Shared shape: JSON 429s the mobile app can display directly.
const handler = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

// Strict — credential guessing / code guessing surface.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many attempts. Please try again later."),
});

// Code issuing is already cooldown-capped per email in the OTP service;
// this adds a per-IP backstop against distribution abuse.
export const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many codes requested. Please try again later."),
});

// Guessing a 6-digit code must be slow as well as attempt-capped.
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many attempts. Please try again later."),
});
