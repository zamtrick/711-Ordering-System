/**
 * QR Delivery Utilities
 *
 * The QR code encodes only the raw MongoDB ObjectId string of the order
 * (24 hex characters). Both apps render the QR image themselves using
 * react-native-qrcode-svg — the server never generates a PNG/data-URL.
 *
 * Why: base64 PNG data-URLs are thousands of characters long. Feeding
 * them into react-native-qrcode-svg as the `value` prop creates a QR
 * of those thousands of characters, which exceeds QR capacity limits and
 * produces "data too large" errors. A 24-char ObjectId generates a tiny,
 * instantly scannable QR code.
 */

/**
 * Returns the orderId string that should be encoded in the QR.
 * Kept as an async function so call-sites don't need to change if we
 * ever add signing/HMAC in the future.
 */
export const generateDeliveryQR = async (orderId) => {
  if (!orderId || typeof orderId !== "string" || orderId.length > 50) {
    throw new Error("Invalid order ID");
  }
  return orderId.trim();
};

/**
 * Verifies a scanned QR payload and extracts the orderId.
 * The payload is just the raw orderId string scanned from the QR.
 */
export const verifyQRPayload = (qrData) => {
  if (!qrData || typeof qrData !== "string" || qrData.trim().length === 0) {
    throw new Error("Invalid QR code — no order ID found");
  }
  const cleanedOrderId = qrData.trim();
  if (cleanedOrderId.length > 50) {
    throw new Error("Invalid QR code — order ID too long");
  }
  return { orderId: cleanedOrderId };
};

export default { generateDeliveryQR, verifyQRPayload };
