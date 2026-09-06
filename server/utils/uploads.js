import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Root folder that is served statically at /uploads (legacy images only)
export const uploadsRoot = path.resolve(__dirname, "..", "uploads");

// Product images live under /uploads/products/... (legacy location)
export const productUploadsDir = path.join(uploadsRoot, "products");

// Make sure the folder exists for any legacy files still being served
fs.mkdirSync(productUploadsDir, { recursive: true });

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

// --------------------------------------------------
// Cloudinary configuration
// --------------------------------------------------
// IMPORTANT: env vars are read lazily (on first use), not at import time.
// ES module imports are evaluated before index.js runs dotenv.config(), so a
// module-level cloudinary.config() would see undefined values.

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

let cloudinaryReady = false;

const ensureCloudinary = () => {
  if (!cloudinaryReady) {
    if (!isCloudinaryConfigured()) {
      const err = new Error(
        "Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env",
      );
      err.statusCode = 503;
      throw err;
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    cloudinaryReady = true;
  }

  return cloudinary;
};

// --------------------------------------------------
// Product image upload — Cloudinary via multer storage engine
// Images land in the "products" folder of the Cloudinary cloud, auto-
// optimized (f_auto/q_auto), capped at 1200px on the long edge.
// --------------------------------------------------

let productImageUploader = null;

export const getProductImageUploader = () => {
  if (productImageUploader) return productImageUploader;

  ensureCloudinary();

  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: "products",
      allowed_formats: ["jpg", "png", "jpeg", "webp", "gif", "avif"],
      public_id: `product-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      transformation: [
        { width: 1200, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" },
      ],
    }),
  });

  productImageUploader = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed (JPG, PNG, WEBP, GIF, AVIF)"));
      }
    },
  });

  return productImageUploader;
};

// --------------------------------------------------
// Delete an image belonging to a product.
// Works in two modes:
//  - Cloudinary URL (https://res.cloudinary.com/...) → destroy by public_id
//  - Legacy local file (/uploads/products/...) → unlink from disk
// --------------------------------------------------

const getPublicIdFromUrl = (url) => {
  try {
    const u = new URL(url);
    // path: /<cloud>/image/upload/[v123.../]<public_id>.<ext>
    const parts = u.pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;

    let segments = parts.slice(uploadIdx + 1);
    if (segments[0] && /^v\d+$/.test(segments[0])) segments = segments.slice(1);

    const publicIdWithExt = segments.join("/");
    return publicIdWithExt.replace(/\.[^.]+$/, ""); // strip extension
  } catch {
    return null;
  }
};

export const removeUploadedFile = (imageUrl) => {
  if (typeof imageUrl !== "string" || imageUrl.length === 0) return;

  // Cloudinary-hosted image
  if (imageUrl.startsWith("http")) {
    const publicId = getPublicIdFromUrl(imageUrl);
    if (!publicId) return;

    ensureCloudinary();

    cloudinary.uploader
      .destroy(publicId)
      .then((result) => {
        if (result?.result && result.result !== "ok" && result.result !== "not found") {
          console.error(`Cloudinary destroy "${publicId}" →`, result.result);
        }
      })
      .catch((err) => {
        console.error(`Cloudinary destroy "${publicId}" failed:`, err.message);
      });
    return;
  }

  // Legacy local file under /uploads
  if (!imageUrl.startsWith("/uploads/")) return;

  const absolute = path.resolve(uploadsRoot, imageUrl.replace(/^\/uploads\//, ""));

  // Safety net against path traversal
  if (!absolute.startsWith(uploadsRoot + path.sep)) return;

  fs.unlink(absolute, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Failed to remove uploaded file:", err.message);
    }
  });
};
