import mongoose from "mongoose";

// --------------------------------------------------
// APP OPEN AD
// --------------------------------------------------
// Self-managed full-screen ad shown when the customer app opens.
// Only one campaign is active platform-wide at a time (superadmin /
// permitted branch admins manage creatives here — no external ad network).
//
// Scheduling fields (startsAt/endsAt) let campaigns auto-expire; when no
// active campaign exists the app simply skips the ad.
// --------------------------------------------------

const appOpenAdSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    // Optional supporting line shown under the title
    subtitle: {
      type: String,
      trim: true,
      maxlength: 140,
      default: "",
    },

    // Uploaded creative (Cloudinary URL). Required for the ad to serve.
    imageUrl: {
      type: String,
      default: null,
    },

    // Where the CTA button leads (deep link or https URL). Empty = CTA
    // just closes the ad.
    ctaUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    // CTA button label (defaults to "Shop Now")
    ctaLabel: {
      type: String,
      trim: true,
      maxlength: 24,
      default: "Shop Now",
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    // Optional availability window (inclusive). null = always.
    startsAt: {
      type: Date,
      default: null,
    },

    endsAt: {
      type: Date,
      default: null,
    },

    // Which admin last touched this campaign (audit trail)
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// Fast lookup for the active campaign
appOpenAdSchema.index({ enabled: 1, endsAt: 1 });

const AppOpenAd = mongoose.model("AppOpenAd", appOpenAdSchema);

export default AppOpenAd;
