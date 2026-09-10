import { useEffect, useState, useContext } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider, SettingsContext } from "@/context/SettingsContext";
import AppSplash from "@/components/AppSplash";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Reads the user's theme preference and renders the correct StatusBar style.
// Must be rendered inside SettingsProvider.
function ThemedStatusBar() {
  const systemScheme = useColorScheme();
  const settings = useContext(SettingsContext);
  const resolved =
    !settings || settings.themePreference === "system"
      ? systemScheme
      : settings.themePreference;
  // "dark" style = dark icons (for light backgrounds)
  // "light" style = light icons (for dark backgrounds)
  return <StatusBar style={resolved === "dark" ? "light" : "dark"} />;
}

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
        <ThemedStatusBar />

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
