import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider } from "@/context/SettingsContext";
import AppSplash from "@/components/AppSplash";

// Keep the native splash screen (7-Eleven logo on brand background) visible
// while the JS bundle loads, so devices never flash white before boot.
// On web this call is a no-op (the SDK 54 web build is a stub) — the AppSplash
// overlay below covers the boot experience there instead.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* noop */
});

export default function RootLayout() {
  // The overlay stays mounted until (a) React has painted the first real frame
  // AND (b) a minimum display window has elapsed — a splash that flashes for
  // 50ms reads as a glitch, not branding. Then it unmounts in the same tick
  // the native splash is hidden — a seamless handoff with no white flash.
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    const MIN_SPLASH_MS = 1400;

    let cancelled = false;
    const started = Date.now();

    const finish = () => {
      if (cancelled) return;
      setBootReady(true);
      SplashScreen.hideAsync().catch(() => {
        /* noop */
      });
    };

    const raf = requestAnimationFrame(() => {
      const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - started));
      const timer = setTimeout(finish, remaining);
      return () => clearTimeout(timer);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <SettingsProvider>
      <CartProvider>
        <StatusBar style="dark" />

        {!bootReady && <AppSplash />}

        <View style={bootReady ? styles.flex : styles.hidden}>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />

            <Stack.Screen name="(customer)" options={{ headerShown: false }} />
          </Stack>
        </View>
      </CartProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  // Kept mounted (so React Navigation state persists) but invisible while the
  // splash overlay is showing.
  hidden: {
    display: "none",
    flex: 1,
  },
});
