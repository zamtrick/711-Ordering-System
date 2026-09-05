import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Root folder that is served statically at /uploads
export const uploadsRoot = path.resolve(__dirname, "..", "uploads");

// Product images live under /uploads/products/...
export const productUploadsDir = path.join(uploadsRoot, "products");

// Make sure the folder exists before multer writes to it
fs.mkdirSync(productUploadsDir, { recursive: true });

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: productUploadsDir,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
      cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (JPG, PNG, WEBP, GIF, AVIF)"));
    }
  },
});

/**
 * Deletes a file previously stored by us.
 * `relativeUrl` is the value stored on the document, e.g. "/uploads/products/xxx.png".
 * Only files inside the uploads root are ever touched.
 */
export const removeUploadedFile = (relativeUrl) => {
  if (typeof relativeUrl !== "string" || !relativeUrl.startsWith("/uploads/")) {
    return;
  }

  const absolute = path.resolve(uploadsRoot, relativeUrl.replace(/^\/uploads\//, ""));

  // Safety net against path traversal
  if (!absolute.startsWith(uploadsRoot + path.sep)) {
    return;
  }

  fs.unlink(absolute, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Failed to remove uploaded file:", err.message);
    }
  });
};
