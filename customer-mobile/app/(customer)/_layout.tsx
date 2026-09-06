import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import {
  House,
  ShoppingBag,
  ShoppingCart,
  ClipboardList,
  User,
} from "lucide-react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import { router } from "expo-router";
import api from "@/api/axios";
import { ActivityIndicator, Text, StyleSheet } from "react-native";

const CustomerLayout = () => {
  const colorScheme = useColorScheme(); // either dark || light

  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;

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
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => (
            <ShoppingBag color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <ClipboardList color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
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
