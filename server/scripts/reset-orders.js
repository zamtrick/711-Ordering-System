import dns from "dns";
import mongoose from "mongoose";
import "../config/env.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import Payment from "../models/Payment.js";
import LoyaltyAccount from "../models/LoyaltyAccount.js";
import LoyaltyTransaction from "../models/LoyaltyTransaction.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Review from "../models/Review.js";
import AuditLog from "../models/AuditLog.js";
import Rider from "../models/Rider.js";

// --------------------------------------------------
// FRESH-START: wipe all order-related data
// --------------------------------------------------
// Deletes orders, their line items, payments, the loyalty ledger, chat threads,
// reviews and audit logs, and resets every loyalty balance to zero.
//
// Destructive: refuses to run unless CONFIRM_RESET=YES is set.
// Run from the server/ directory:
//   $env:CONFIRM_RESET="YES"; node scripts/reset-orders.js      (PowerShell)
//   CONFIRM_RESET=YES node scripts/reset-orders.js              (bash)
// --------------------------------------------------

// Node's c-ares resolver can fail the SRV/TXT lookups a mongodb+srv URI needs
// (ESERVFAIL) even when the OS resolves the host — pin public DNS for Atlas.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const wipe = async () => {
  if (process.env.CONFIRM_RESET !== "YES") {
    console.error(
      "Refusing to run. This wipes all order data. Set CONFIRM_RESET=YES to proceed.",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URI);
    console.log(`Connected to database: ${mongoose.connection.name}`);

    const collections = [
      ["Order", Order],
      ["OrderItem", OrderItem],
      ["Payment", Payment],
      ["LoyaltyTransaction", LoyaltyTransaction],
      ["Conversation", Conversation],
      ["Message", Message],
      ["Review", Review],
      ["AuditLog", AuditLog],
    ];

    for (const [name, model] of collections) {
      const { deletedCount } = await model.deleteMany({});
      console.log(`  ${name}: ${deletedCount} deleted`);
    }

    const balances = await LoyaltyAccount.updateMany(
      {},
      { $set: { points: 0, lifetimeEarned: 0, lifetimeRedeemed: 0 } },
    );
    console.log(`  LoyaltyAccount: ${balances.modifiedCount} balances reset`);

    // Orders are gone, so no rider can still be mid-delivery.
    const riders = await Rider.updateMany(
      { availabilityStatus: "delivering" },
      { $set: { availabilityStatus: "available" } },
    );
    console.log(`  Rider: ${riders.modifiedCount} set back to available`);

    console.log("Fresh start complete.");
  } catch (err) {
    console.error("Reset failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

wipe();
