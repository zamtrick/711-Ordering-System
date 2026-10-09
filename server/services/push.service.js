import Customer from "../models/Customer.js";

/* -------------------------------------------------------------------------- */
/* PUSH NOTIFICATION SERVICE                                                  */
/* -------------------------------------------------------------------------- */
/* Sends Expo push notifications (expo-notifications on the customer app).    */
/* Uses Expo's push REST API directly — no extra dependency needed.           */
/* Like the email service, every export is fire-and-forget safe: callers       */
/* should not await results on the request path (use .catch(() => {})).        */
/* -------------------------------------------------------------------------- */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100; // Expo accepts up to 100 messages per request

// Keep sends off the hot path but still log failures.
const log = (...args) => console.log("🔔 [PUSH]", ...args);
const logError = (...args) => console.error("🔔 [PUSH]", ...args);

async function sendChunk(messages) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    throw new Error(`Expo push API responded with ${res.status}`);
  }

  const json = await res.json();
  // Tickets come back in the same order as the messages were sent, so a
  // DeviceNotRegistered ticket maps to messages[i].to.
  const tickets = json?.data ?? [];
  // Pair tickets with their device BEFORE filtering: filtering first reindexes
  // the array, so mapping afterwards would prune the wrong tokens.
  const deadTokens = tickets
    .map((ticket, i) => ({ ticket, to: messages[i]?.to }))
    .filter(
      ({ ticket, to }) =>
        ticket?.status === "error" &&
        ticket?.details?.error === "DeviceNotRegistered" &&
        to,
    )
    .map(({ to }) => to);

  return { tickets, deadTokens };
}

// Drop tokens Expo says are dead so we stop sending to them forever.
async function pruneDeadTokens(customerId, deadTokens) {
  try {
    if (!deadTokens?.length) return;
    await Customer.findByIdAndUpdate(customerId, {
      $pull: { pushTokens: { token: { $in: deadTokens } } },
    });
    log(`Pruned ${deadTokens.length} stale token(s)`);
  } catch (err) {
    logError("Token prune failed:", err.message);
  }
}

/**
 * Send a push notification to every registered device of a user.
 * Never throws — always resolves so callers can fire-and-forget.
 */
export async function pushToUser(userId, { title, body, data = {}, sound = "default" }) {
  try {
    if (!userId || !title || !body) return { success: false, skipped: true };

    const customer = await Customer.findOne({ user: userId }).select(
      "pushTokens",
    );
    const tokens = (customer?.pushTokens ?? [])
      .map((t) => t?.token)
      .filter(Boolean);

    if (!tokens.length) return { success: false, skipped: true, reason: "no tokens" };

    const messages = tokens.map((token) => ({
      to: token,
      sound,
      title,
      body,
      data,
      priority: "high",
      channelId: "order-updates",
    }));

    const deadTokens = [];
    let sent = 0;
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      try {
        const result = await sendChunk(chunk);
        deadTokens.push(...result.deadTokens);
        sent += result.tickets.filter((t) => t?.status === "ok").length;
      } catch (err) {
        logError("Send failed:", err.message);
      }
    }

    await pruneDeadTokens(customer._id, deadTokens);

    log(`Sent "${title}" to ${tokens.length} device(s)`);
    return { success: true, sent };
  } catch (err) {
    logError("pushToUser failed:", err.message);
    return { success: false, error: err.message };
  }
}

/* -------------------------------------------------------------------------- */
/* ORDER NOTIFICATIONS                                                        */
/* -------------------------------------------------------------------------- */

function orderIdShort(order) {
  return order?._id?.toString().slice(-6).toUpperCase() ?? "";
}

// Derives a human message from the order's current status. Callers may pass
// an explicit message when the generic wording doesn't fit (e.g. rider assigned).
function describeOrder(order) {
  const id = `#${orderIdShort(order)}`;

  if (order.status === "cancelled") {
    return {
      title: `Order ${id} cancelled`,
      body: "Your order has been cancelled. Tap to view the details.",
    };
  }
  if (order.status === "refunded") {
    return {
      title: `Order ${id} refunded`,
      body: "Your order has been refunded. Tap for details.",
    };
  }
  if (order.deliveryStatus === "delivered" || order.status === "completed") {
    return {
      title: `Order ${id} delivered 🎉`,
      body: "Your order has arrived. Enjoy!",
    };
  }
  if (order.deliveryStatus === "in_transit") {
    return {
      title: `Order ${id} on the way 🛵`,
      body: "Your rider is heading to your delivery address.",
    };
  }
  if (order.deliveryStatus === "picked_up") {
    return {
      title: `Order ${id} picked up`,
      body: "Your rider has picked up your order.",
    };
  }
  if (order.deliveryStatus === "assigned") {
    return {
      title: `Order ${id} — rider assigned`,
      body: "A rider has been assigned to your order.",
    };
  }
  if (order.status === "processing") {
    return {
      title: `Order ${id} being prepared 👨‍🍳`,
      body: "The store is preparing your order now.",
    };
  }
  return {
    title: `Order ${id} received ✅`,
    body: "Your order has been placed successfully.",
  };
}

/**
 * Notify the order's customer about its current state.
 * `message` is optional — omit it to derive the text from order fields.
 * The order must have `user` populated (or be a plain userId) and `_id`.
 */
export async function pushOrderUpdate(order, message) {
  try {
    if (!order) return;
    const userId = order.user?._id ?? order.user;
    if (!userId) return;

    const { title, body } = message ?? describeOrder(order);
    const orderId = order._id?.toString();

    await pushToUser(userId, {
      title,
      body,
      data: {
        type: "order",
        orderId,
        status: order.status,
        deliveryStatus: order.deliveryStatus,
        path: `/(customer)/orders/${orderId}`,
      },
    });
  } catch (err) {
    logError("pushOrderUpdate failed:", err.message);
  }
}

/* -------------------------------------------------------------------------- */
/* CHAT NOTIFICATION                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Notify a customer that a branch admin or rider replied in chat.
 * `conversationId` lets the app deep-link straight into the thread.
 */
export async function pushNewMessageToCustomer({ userId, orderId, senderName, text }) {
  try {
    if (!userId || !text) return;
    const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;

    await pushToUser(userId, {
      title: `New message from ${senderName || "7-Eleven"}`,
      body: preview,
      data: {
        type: "chat",
        orderId: orderId ?? null,
        path: orderId ? "/(customer)/orders/" + orderId : "/(customer)/chat",
      },
    });
  } catch (err) {
    logError("pushNewMessageToCustomer failed:", err.message);
  }
}

export default { pushToUser, pushOrderUpdate, pushNewMessageToCustomer };
