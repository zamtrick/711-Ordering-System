import { DarkTheme, LightTheme } from "@/constants/Theme";
import React from "react";
import { StyleSheet, useColorScheme, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ThemedView = ({ style, ...props }: ViewProps) => {
  const colorScheme = useColorScheme();

  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
        },
        style,
      ]}
      {...props}
    />
  );
};

export default ThemedView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
