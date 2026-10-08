// One-time restore after accidental conversation/rider deletion (2026-09-28).
// Reinserts docs with ORIGINAL _ids so surviving messages reconnect.
//
// Context: a cleanup during endpoint testing ran deleteMany({}) on the riders
// and conversations collections. Damage assessment found:
//   - Users/branches/orders were NOT touched by the bad command.
//   - Most deleted conversations belonged to users/branches that were ALREADY
//     gone (earlier test-script cleanups) or would violate the unique
//     (customer, branch) support-thread index — those are NOT restorable.
//   - Exactly one conversation connects two surviving users on a live branch
//     (customer 6a9a3af658c4fb59b168f94d + branch admin 6aa75460208258470c87e110
//     on branch 6aa75437208258470c87e10e) → restored below.
//   - The Rider doc for user 6aa754aa208258470c87e113 (Juan Carlos,
//     carlos@gmail.com) is restorable; audit logs reference its original _id
//     (6aa754aa208258470c87e114) from order assignment history.
//
// Idempotent: skips any doc that already exists. Also repairs any earlier
// string-typed insertion of these docs (raw-driver runs without ObjectId cast).

import "dotenv/config";
import mongoose from "mongoose";

const MAIN_BRANCH = new mongoose.Types.ObjectId("6aa75437208258470c87e10e"); // 711 Burgos (live)
const RIDER_ID = new mongoose.Types.ObjectId("6aa754aa208258470c87e114"); // original, from audit logs
const RIDER_USER = new mongoose.Types.ObjectId("6aa754aa208258470c87e113"); // survives (carlos@gmail.com)
const LIVE_CONV_ID = new mongoose.Types.ObjectId("6aa759bd318713c264a0dc97"); // 18-message support thread
const LIVE_CUSTOMER = new mongoose.Types.ObjectId("6a9a3af658c4fb59b168f94d"); // survives

await mongoose.connect(process.env.DB_URI);

const db = mongoose.connection.db;

// ── 0. Remove any broken string-typed copies from earlier runs ─────────────
const broken = await db
  .collection("riders")
  .deleteMany({ _id: RIDER_ID.toString() });
const broken2 = await db
  .collection("conversations")
  .deleteMany({ _id: LIVE_CONV_ID.toString() });
if (broken.deletedCount || broken2.deletedCount)
  console.log(
    `removed broken string-typed docs: riders=${broken.deletedCount} conversations=${broken2.deletedCount}`,
  );

// ── 1. Rider doc ────────────────────────────────────────────────────────────
if (await db.collection("riders").findOne({ _id: RIDER_ID })) {
  console.log("rider: already exists, skipped");
} else {
  // phone/address/age/vehicle were not recoverable — placeholders that
  // satisfy the schema (phone + plate are unique-indexed, values kept
  // clearly fake). Admin can edit them from the Riders page.
  await db.collection("riders").insertOne({
    _id: RIDER_ID,
    user: RIDER_USER,
    assignedBranch: MAIN_BRANCH,
    phone: "09000000000", // placeholder — original lost
    address: "Restored placeholder address", // placeholder — original lost
    age: 25, // placeholder — original lost
    vehicleType: "motorcycle", // placeholder — original lost
    vehiclePlateNumber: "RSTROO1", // placeholder — original lost
    availabilityStatus: "offline",
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  });
  console.log("rider: restored", RIDER_ID);
}

// ── 2. Live support conversation (original _id → messages reconnect) ───────
if (await db.collection("conversations").findOne({ _id: LIVE_CONV_ID })) {
  console.log("conversation: already exists, skipped");
} else {
  const msgs = await db
    .collection("messages")
    .find({ conversation: LIVE_CONV_ID })
    .sort({ createdAt: 1 })
    .toArray();
  const first = msgs[0];
  const last = msgs[msgs.length - 1];
  await db.collection("conversations").insertOne({
    _id: LIVE_CONV_ID,
    customer: LIVE_CUSTOMER,
    branch: MAIN_BRANCH,
    order: null,
    rider: null,
    lastMessage: last ? last.text : "",
    lastMessageAt: last ? last.createdAt : null,
    unreadAdmin: 0,
    unreadCustomer: 0,
    unreadRider: 0,
    createdAt: first ? first.createdAt : new Date(),
    updatedAt: last ? last.createdAt : new Date(),
    __v: 0,
  });
  console.log(
    `conversation: restored ${LIVE_CONV_ID} (${msgs.length} messages reconnected)`,
  );
}

// ── 3. Verify ───────────────────────────────────────────────────────────────
const riderCount = await db.collection("riders").countDocuments();
const convCount = await db.collection("conversations").countDocuments();
const orphanMsgs = await db
  .collection("messages")
  .countDocuments({
    conversation: {
      $nin: (await db.collection("conversations").find().project({ _id: 1 }).toArray()).map(
        (c) => c._id,
      ),
    },
  });
console.log(
  `verify: riders=${riderCount} conversations=${convCount} orphanMessages=${orphanMsgs}`,
);
await mongoose.disconnect();
