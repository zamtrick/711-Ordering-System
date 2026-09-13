/**
 * One-time migration: drop the old single-field unique index on
 * Conversation.customer and let Mongoose recreate the correct compound
 * index { customer: 1, branch: 1 } on next server start.
 *
 * Run once: node server/scripts/migrate-conversation-index.js
 */

import "dotenv/config";
import mongoose from "mongoose";

const { DB_URI } = process.env;

async function run() {
  await mongoose.connect(DB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const col = db.collection("conversations");

  const indexes = await col.indexes();
  console.log("Current indexes:", indexes.map((i) => i.name));

  // Drop the old single-field unique index on customer if it exists
  const old = indexes.find(
    (i) =>
      i.unique === true &&
      Object.keys(i.key).length === 1 &&
      i.key.customer === 1,
  );

  if (old) {
    await col.dropIndex(old.name);
    console.log(`Dropped old index: ${old.name}`);
  } else {
    console.log("Old index not found — nothing to drop.");
  }

  // Also backfill branch on any legacy conversations that are missing it.
  // We can't know which branch they belong to, so we leave branch absent —
  // those conversations will still work but won't appear in branch-scoped
  // admin views until the customer starts a new one with a branch selected.
  const legacy = await col.countDocuments({ branch: { $exists: false } });
  if (legacy > 0) {
    console.log(
      `Warning: ${legacy} conversation(s) have no branch field. ` +
      `Customers will need to start a new conversation by selecting a branch.`,
    );
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
