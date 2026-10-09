import Customer from "../../models/Customer.js";

/* -------------------------------------------------------------------------- */
/* PUSH NOTIFICATION REGISTRATION (CUSTOMER)                                  */
/* -------------------------------------------------------------------------- */
/* The customer app calls these after the OS permission prompt so the server  */
/* knows which Expo push tokens belong to which customer.                     */
/* -------------------------------------------------------------------------- */

// One customer rarely owns more than a phone + tablet — cap the list so a
// token-flooding client can't grow the document unbounded.
const MAX_TOKENS_PER_CUSTOMER = 8;

const isValidToken = (token) =>
  typeof token === "string" &&
  token.length > 0 &&
  token.length <= 512 &&
  token.startsWith("ExpoPushToken[");

/* POST /api/customer/notifications/register — body: { token, platform, deviceName } */
export const registerToken = async (req, res) => {
  try {
    const { token, platform, deviceName } = req.body ?? {};

    if (!isValidToken(token)) {
      return res.status(400).json({
        success: false,
        message: "A valid Expo push token is required",
      });
    }

    const customer = await Customer.findOne({ user: req.user.userId });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const existing = customer.pushTokens.find((t) => t.token === token);
    if (existing) {
      existing.lastUsedAt = new Date();
      if (platform) existing.platform = platform;
      if (deviceName) existing.deviceName = deviceName;
    } else {
      customer.pushTokens.push({
        token,
        platform: ["ios", "android", "web"].includes(platform) ? platform : "android",
        deviceName,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      });
      // Oldest entries fall off once the cap is reached.
      while (customer.pushTokens.length > MAX_TOKENS_PER_CUSTOMER) {
        customer.pushTokens.shift();
      }
    }

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Push token registered",
      data: { devices: customer.pushTokens.length },
    });
  } catch (err) {
    console.error("Register push token error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* POST /api/customer/notifications/unregister — body: { token } */
export const unregisterToken = async (req, res) => {
  try {
    const { token } = req.body ?? {};

    if (!isValidToken(token)) {
      return res.status(400).json({
        success: false,
        message: "A valid Expo push token is required",
      });
    }

    const customer = await Customer.findOne({ user: req.user.userId });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    customer.pushTokens = customer.pushTokens.filter((t) => t.token !== token);
    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Push token removed",
      data: { devices: customer.pushTokens.length },
    });
  } catch (err) {
    console.error("Unregister push token error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* GET /api/customer/notifications — current registration status */
export const getStatus = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.userId }).select(
      "pushTokens",
    );

    return res.status(200).json({
      success: true,
      data: {
        registered: (customer?.pushTokens?.length ?? 0) > 0,
        devices: customer?.pushTokens?.length ?? 0,
      },
    });
  } catch (err) {
    console.error("Get push status error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
