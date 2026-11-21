import rateLimit from "express-rate-limit";

// Shared shape: JSON 429s the mobile app can display directly.
const handler = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

// Broad backstop for every API route. Kept generous because the admin polls
// several queries and both mobile apps poll the socket; tune via env if a
// branch ever hits it legitimately.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many requests. Please slow down and try again."),
});

// Checkout is expensive (order + items + payment writes) and a common abuse
// target. Cap order creation per IP without throttling normal browsing.
export const orderCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many orders created. Please try again later."),
});

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

// Promo code lookup is a guessable surface — cap trial attempts per IP so
// codes can't be brute-forced from the checkout preview endpoint.
export const promoCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many promo code attempts. Please try again later."),
});
