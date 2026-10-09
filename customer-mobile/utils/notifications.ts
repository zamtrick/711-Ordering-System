import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import api from "@/api/axios";

// --------------------------------------------------
// PUSH NOTIFICATIONS (expo-notifications)
// --------------------------------------------------
// Registration flow:
//   1. Ask the OS for permission (native prompt, once per install).
//   2. Get the Expo push token for this device (keyed by the EAS projectId).
//   3. Upload it to POST /customer/notifications/register so the server can
//      fan out order/chat updates to every device of this customer.
// The server-side counterpart is server/services/push.service.js.
// --------------------------------------------------

const TOKEN_KEY = "@settings/pushToken";

export type PushEnableResult = "ok" | "denied" | "error";

// Foreground behavior: show the banner + play the sound even while the
// app is open, instead of silently delivering to the tray.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Android 8+ drops notifications that target an unknown channel, and the
// server always tags pushes with "order-updates" — so create it up front.
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("order-updates", {
      name: "Order updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#007A53",
      sound: "default",
    });
  } catch {
    // channel creation failure must never block registration
  }
}

function currentPlatform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "web") return "web";
  return "android";
}

/** Ask the OS for permission and return the Expo push token (or null). */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    await ensureAndroidChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Enable push notifications: request permission, fetch the token and
 * register it with the server. Call from the Settings toggle and on
 * app start when the toggle is on.
 */
export async function enablePushNotifications(): Promise<PushEnableResult> {
  try {
    await ensureAndroidChannel();

    // Permission first, so a denial is reported as "denied" (Settings shows
    // an alert) and a token failure stays a silent "error".
    const { status: existing } = await Notifications.getPermissionsAsync();
    const status =
      existing === "granted"
        ? existing
        : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return "denied";

    const token = await getExpoPushToken();
    if (!token) return "error";

    await api.post("/customer/notifications/register", {
      token,
      platform: currentPlatform(),
      deviceName: Platform.OS,
    });
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    return "ok";
  } catch {
    return "error";
  }
}

/**
 * Disable push notifications: drop this device's token server-side so it
 * stops receiving messages. Falls back to the cached token when the OS
 * permission has already been revoked (the live token is then unreachable).
 */
export async function disablePushNotifications(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
    const token = cached ?? (await getExpoPushToken());
    if (!token) return;

    await api.post("/customer/notifications/unregister", { token });
    await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  } catch {
    // best-effort — a stale token is pruned server-side when sends fail
  }
}

// --------------------------------------------------
// TAP NAVIGATION
// --------------------------------------------------
// The server attaches `path` to every push (e.g. /(customer)/orders/<id>)
// so tapping a notification lands on the relevant screen.
// --------------------------------------------------

function openNotification(
  response: Notifications.NotificationResponse,
): void {
  const data = response.notification.request.content.data as
    | { path?: unknown }
    | undefined;
  const path = typeof data?.path === "string" ? data.path : null;
  if (path) {
    router.push(path as Parameters<typeof router.push>[0]);
  }
}

/**
 * Listen for notification taps. Returns subscriptions — remove them all on
 * unmount. Also handles the cold-start case (app launched by a tap).
 */
export function initPushNotificationTaps(): Notifications.Subscription[] {
  const subscription =
    Notifications.addNotificationResponseReceivedListener(openNotification);

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) openNotification(response);
    })
    .catch(() => {});

  return [subscription];
}
