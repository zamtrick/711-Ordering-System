/**
 * QR Delivery Utilities
 *
 * The QR encodes a SIGNED token: `<orderId>.<hmac-sha256-hex>`.
 * Both apps render the QR image themselves using react-native-qrcode-svg —
 * the server never generates a PNG/data-URL.
 *
 * Why: base64 PNG data-URLs are thousands of characters long. Feeding
 * them into react-native-qrcode-svg as the `value` prop creates a QR
 * of those thousands of characters, which exceeds QR capacity limits and
 * produces "data too large" errors. A short signed string generates a
 * tiny, instantly scannable QR code.
 *
 * Signing (HMAC-SHA256 with JWT_SECRET) stops anyone from forging a QR
 * for an order they don't own by just typing its 24-char ObjectId.
 */

import crypto from "node:crypto";

const getSecret = () => process.env.JWT_SECRET || "dev-secret";

/**
 * Signs an orderId into `<orderId>.<hexSig>`.
 */
export const signOrderToken = (orderId) => {
  const clean = String(orderId ?? "").trim();
  if (!clean || clean.length > 50) {
    throw new Error("Invalid order ID");
  }
  const sig = crypto.createHmac("sha256", getSecret()).update(clean).digest("hex");
  return `${clean}.${sig}`;
};

/**
 * Verifies a signed token — returns the orderId, or null when invalid.
 * Timing-safe compare so signatures can't be brute-forced byte-by-byte.
 */
export const verifyOrderToken = (token) => {
  if (!token || typeof token !== "string") return null;
  const clean = token.trim();
  const dot = clean.lastIndexOf(".");
  if (dot <= 0) return null;
  const orderId = clean.slice(0, dot);
  const sig = clean.slice(dot + 1);
  if (!orderId || !sig || orderId.length > 50 || sig.length > 128) return null;
  let expected;
  try {
    expected = crypto.createHmac("sha256", getSecret()).update(orderId).digest("hex");
  } catch {
    return null;
  }
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return orderId;
};

/**
 * Returns the SIGNED value that should be encoded in the QR.
 * Kept as an async function so call-sites don't need to change.
 */
export const generateDeliveryQR = async (orderId) => {
  if (!orderId || typeof orderId !== "string" || orderId.length > 50) {
    throw new Error("Invalid order ID");
  }
  return signOrderToken(orderId.trim());
};

/**
 * Verifies a scanned QR payload and extracts the orderId.
 * Requires a valid signature — raw orderIds are rejected.
 */
export const verifyQRPayload = (qrData) => {
  if (!qrData || typeof qrData !== "string" || qrData.trim().length === 0) {
    throw new Error("Invalid QR code — no order ID found");
  }
  const cleaned = qrData.trim();
  if (cleaned.length > 200) {
    throw new Error("Invalid QR code — order ID too long");
  }
  const orderId = verifyOrderToken(cleaned);
  if (!orderId) {
    throw new Error("Invalid QR code — bad signature");
  }
  return { orderId };
};

export default { generateDeliveryQR, verifyQRPayload, signOrderToken, verifyOrderToken };
