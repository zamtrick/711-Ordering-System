import { useEffect, useState } from "react";
import { Tabs, router } from "expo-router";
import { useColorScheme, type ColorValue, ActivityIndicator, Text, StyleSheet } from "react-native";
import {
  House,
  ShoppingBag,
  ClipboardList,
  User,
} from "lucide-react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import CartTabIcon from "@/components/CartTabIcon";
import { useSettings } from "@/context/SettingsContext";

const CustomerLayout = () => {
  const systemScheme = useColorScheme();
  const { themePreference } = useSettings();
  const resolvedScheme =
    themePreference === "system" ? systemScheme : themePreference;
  const theme = resolvedScheme === "dark" ? DarkTheme : LightTheme;

  // Auth guard: verify the session once before showing any tab screen.
  // Without this, an expired session makes every tab fail independently
  // (spinner → error → late redirect); with it, the user lands on login fast.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    api
      .get("/auth/me")
      .then((res) => {
        if (!mounted) return;
        // Only actual customers may use the customer app.
        if (res.data?.data?.role !== "customer") {
          router.replace("/(auth)/login");
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!mounted) return;
        router.replace("/(auth)/login");
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={styles.checkingText}>Loading...</Text>
      </ThemedView>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#078080",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: {
          //attribute of the taskbar
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border, //border of the tab nav
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <House color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
            <ShoppingBag color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <CartTabIcon color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
            <ClipboardList color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <User color={color} size={size} />,
        }}
      />

      {/* Hidden screen — no tab button */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  checkingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#777777",
  },
});

export default CustomerLayout;
