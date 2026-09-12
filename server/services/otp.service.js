import crypto from "node:crypto";
import Otp from "../models/Otp.js";

// --------------------------------------------------
// OTP SERVICE
// --------------------------------------------------
// 6-digit codes, 10-minute expiry, hashed at rest with a per-code salt.
// One subsystem serves registration ("verify") and password reset
// ("reset") via the purpose field.

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5;

const hashCode = (code, salt) =>
  crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");

// Issue a fresh code, invalidating older live ones for the same
// email + purpose so only the latest code works. Enforces the resend
// cooldown and hourly cap — throws an Error with .status for HTTP mapping.
export const issueOtp = async (email, purpose) => {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const recent = await Otp.find({ email: normalizedEmail, purpose })
    .sort({ createdAt: -1 })
    .limit(OTP_MAX_PER_HOUR);

  const live = recent.filter((o) => !o.consumed && o.expiresAt > now);

  const newest = recent[0];
  if (
    newest &&
    now.getTime() - newest.createdAt.getTime() <
      OTP_RESEND_COOLDOWN_SECONDS * 1000
  ) {
    const wait = Math.ceil(
      OTP_RESEND_COOLDOWN_SECONDS -
        (now.getTime() - newest.createdAt.getTime()) / 1000,
    );
    const err = new Error(
      `Please wait ${wait}s before requesting a new code.`,
    );
    err.status = 429;
    err.retryAfter = wait;
    throw err;
  }

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const issuedThisHour = recent.filter((o) => o.createdAt > hourAgo).length;
  if (issuedThisHour >= OTP_MAX_PER_HOUR) {
    const err = new Error(
      "Too many codes requested. Please try again later.",
    );
    err.status = 429;
    throw err;
  }

  // Invalidate older live codes — only the newest one stays usable.
  if (live.length > 0) {
    await Otp.updateMany(
      { _id: { $in: live.map((o) => o._id) } },
      { $set: { consumed: true } },
    );
  }

  const code = String(
    crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH),
  );
  const salt = crypto.randomBytes(16).toString("hex");

  await Otp.create({
    email: normalizedEmail,
    codeHash: hashCode(code, salt),
    salt,
    purpose,
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  return code;
};

// Verify a submitted code. Returns { ok: true } on success and consumes
// the code (single-use). Throws with .status on any failure; messages stay
// generic so attackers can't probe which emails exist.
export const verifyOtp = async (email, code, purpose) => {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const record = await Otp.findOne({
    email: normalizedEmail,
    purpose,
    consumed: false,
  }).sort({ createdAt: -1 });

  if (!record || record.expiresAt <= now) {
    const err = new Error("Invalid or expired code.");
    err.status = 400;
    throw err;
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    record.consumed = true;
    await record.save();
    const err = new Error(
      "Too many wrong attempts. Please request a new code.",
    );
    err.status = 400;
    throw err;
  }

  const submitted = String(code ?? "").trim();
  const expected = record.codeHash;
  const actual = hashCode(submitted, record.salt);

  const match =
    submitted.length === OTP_LENGTH &&
    expected.length === actual.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));

  if (!match) {
    record.attempts += 1;
    await record.save();
    const err = new Error("Invalid or expired code.");
    err.status = 400;
    throw err;
  }

  record.consumed = true;
  await record.save();
  return { ok: true };
};

// Seconds until the user may request another code (0 = now).
export const resendAvailableIn = async (email, purpose) => {
  const normalizedEmail = email.trim().toLowerCase();
  const newest = await Otp.findOne({ email: normalizedEmail, purpose }).sort({
    createdAt: -1,
  });
  if (!newest) return 0;
  const elapsed =
    (Date.now() - newest.createdAt.getTime()) / 1000;
  return Math.max(
    0,
    Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed),
  );
};
