import { View, ViewStyle, useColorScheme } from "react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useContext } from "react";
import { SettingsContext } from "@/context/SettingsContext";

type ThemedViewProps = React.ComponentProps<typeof View> & {
  style?: ViewStyle | (ViewStyle | undefined | null | false)[];
};

const ThemedView = ({ style, ...props }: ThemedViewProps) => {
  const systemScheme = useColorScheme();
  // SettingsContext may not be mounted yet during the splash — fall back
  // gracefully to the system colour scheme so the component never throws.
  const settings = useContext(SettingsContext);

  const resolvedScheme =
    !settings || settings.themePreference === "system"
      ? systemScheme
      : settings.themePreference;

  const theme = resolvedScheme === "dark" ? DarkTheme : LightTheme;

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}
      {...props}
    />
  );
};

export default ThemedView;
