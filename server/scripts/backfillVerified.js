// One-time backfill: mark every existing account as email-verified so the
// OTP rollout doesn't lock out current users (admins, riders, customers).
// New self-registrations start unverified via POST /auth/register.
//
// Usage: node scripts/backfillVerified.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    const result = await User.updateMany(
      { isVerified: { $ne: true } },
      { $set: { isVerified: true } },
    );
    console.log(`Backfilled isVerified=true on ${result.modifiedCount} user(s).`);
  } catch (err) {
    console.error("Backfill failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
