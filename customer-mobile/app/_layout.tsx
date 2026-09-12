import { useEffect, useState, useContext } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { CartProvider } from "@/context/CartContext";
import { FavoriteProvider } from "@/context/FavoriteContext";
import { SettingsProvider, SettingsContext } from "@/context/SettingsContext";
import AppSplash from "@/components/AppSplash";
import * as SystemUI from "expo-system-ui";

import { LightTheme, DarkTheme } from "@/constants/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function resolveScheme(
  themePreference: "system" | "light" | "dark" | undefined,
  systemScheme: string | null | undefined
) {
  if (!themePreference || themePreference === "system")
    return systemScheme === "dark" ? "dark" : "light";
  return themePreference;
}

// Reads the user's theme preference and renders the correct StatusBar.
// Must be rendered inside SettingsProvider.
// SDK 57 is edge-to-edge: the status bar is transparent and the app draws
// under it, so there is no backgroundColor prop. The bar's background is
// whatever the root view paints behind it (ThemedRoot below + SystemUI
// root-view background). Style only controls icon/text color.
function ThemedStatusBar() {
  const systemScheme = useColorScheme();
  const settings = useContext(SettingsContext);
  const resolved = resolveScheme(settings?.themePreference, systemScheme);
  // "dark" style = dark icons (for light backgrounds)
  // "light" style = light icons (for dark backgrounds)
  return <StatusBar style={resolved === "dark" ? "light" : "dark"} />;
}

function ThemedRoot({ bootReady }: { bootReady: boolean }) {
  const systemScheme = useColorScheme();
  const settings = useContext(SettingsContext);
  const resolved = resolveScheme(settings?.themePreference, systemScheme);
  const theme = resolved === "dark" ? DarkTheme : LightTheme;

  // Keep the native window background in sync with the theme so the
  // translucent status-bar area never shows a black flash.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [theme.colors.background]);

  return (
    <View
      style={[
        bootReady ? styles.flex : styles.hidden,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
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
        <FavoriteProvider>
          <ThemedStatusBar />

          {!bootReady && <AppSplash />}

          <ThemedRoot bootReady={bootReady} />
        </FavoriteProvider>
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
