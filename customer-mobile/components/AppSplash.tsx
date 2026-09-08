import { Image, StyleSheet, Text, useColorScheme, View } from "react-native";

import logo from "@/assets/logos/711logo.png";

// --------------------------------------------------
// APP SPLASH
// --------------------------------------------------
// Full-screen branded splash shown while the app boots. Visuals intentionally
// match the native splash configured in app.json (same logo + background) so
// the handoff from the native splash → this overlay → the first screen is
// seamless on devices, and web (which has no native splash) still gets the
// branded boot experience.
//
// Visibility is controlled by the root layout (_layout.tsx): it renders this
// until the first frame is painted, then unmounts it and hides the native
// splash in the same tick.
// --------------------------------------------------

const AppSplash = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View testID="app-splash" style={[styles.fill, { backgroundColor: isDark ? "#121212" : "#007A53" }]}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />

      <Text style={[styles.tagline, { color: isDark ? "#A0A0A0" : "rgba(255,255,255,0.85)" }]}>
        7-Eleven Online Ordering
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 999,
    elevation: 999,
  },

  logo: {
    width: 200,
    height: 200,
  },

  tagline: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 18,
    letterSpacing: 0.3,
  },
});

export default AppSplash;
