import mongoose from "mongoose";

// Simple key/value store for app-wide settings managed by admins.
// Values are JSON-encoded strings so any scalar/object can be stored.
const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    value: {
      type: String,
      required: true,
    },

    // Who last changed this setting (null = system default)
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

const Setting = mongoose.model("Setting", settingSchema);

export default Setting;
