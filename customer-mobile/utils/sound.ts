import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Web path — plays the tap.wav sound only on web.
// ---------------------------------------------------------------------------
let webAudio: HTMLAudioElement | null = null;

function webPlay() {
  if (typeof document === "undefined") return;
  if (!webAudio) {
    const mod = require("../assets/sounds/tap.wav");
    // Metro may return: a string (base64 or uri), or an object with uri/width/etc.
    const raw =
      typeof mod === "string"
        ? mod
        : (mod as any).uri ?? (mod as any).default ?? (mod as any).base64;
    let src: string | null = null;
    if (typeof raw === "string" && raw.startsWith("data:")) {
      src = raw;
    } else if (typeof raw === "string" && raw.startsWith("http")) {
      src = raw;
    } else if (typeof raw === "string") {
      // base64 without data prefix — rebuild it
      src = `data:audio/wav;base64,${raw}`;
    }
    webAudio = (src != null
      ? new (window as any).Audio(src)
      : new (window as any).Audio()) as HTMLAudioElement;
    webAudio.volume = 1;
  }
  const a: HTMLAudioElement = (webAudio ?? (webAudio = new (window as any).Audio())) as HTMLAudioElement;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

// ---------------------------------------------------------------------------
// Native path — haptic feedback (expo-av requires a dev build; expo-haptics
// works in Expo Go and provides the same tactile feedback).
// ---------------------------------------------------------------------------
async function nativeTap() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;

  try {
    const Haptics = await import("expo-haptics");
    Haptics.selectionAsync().catch(() => {});
  } catch (err) {
    // Silently fail on native module errors
    console.warn("Could not play tap feedback:", err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function playTap() {
  if (Platform.OS === "web") {
    webPlay();
    return;
  }
  nativeTap().catch(() => {});
}
