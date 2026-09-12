import { useColorScheme } from "react-native";
import { useContext, useMemo } from "react";
import { SettingsContext } from "@/context/SettingsContext";
import { LightTheme, DarkTheme } from "@/constants/theme";

// --------------------------------------------------
// useTheme
// --------------------------------------------------
// Resolves the active theme from the user's preference
// (system | light | dark) stored in SettingsContext, falling back to the
// OS colour scheme when the preference is "system" or the context isn't
// mounted yet (e.g. splash screens).
//
// Usage:
//   const { theme, scheme, isDark } = useTheme();
//   <View style={{ backgroundColor: theme.colors.surface }} />
// --------------------------------------------------

export const useTheme = () => {
  const systemScheme = useColorScheme();
  const settings = useContext(SettingsContext);

  const resolvedScheme =
    !settings || settings.themePreference === "system"
      ? systemScheme
      : settings.themePreference;

  const scheme = resolvedScheme === "dark" ? "dark" : "light";
  const theme = scheme === "dark" ? DarkTheme : LightTheme;

  return useMemo(
    () => ({ theme, scheme, isDark: scheme === "dark" }),
    [theme, scheme]
  );
};

export default useTheme;
