import { DarkTheme, LightTheme } from "@/constants/Theme";
import { Tabs, router } from "expo-router";
import { useColorScheme, View } from "react-native";
import {
  Home,
  PackageCheck,
  ClipboardList,
  User,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import api from "@/api/axios";

const Layout = () => {
  const { user, loading } = useAuth();
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/login");
    } else if (!loading && user && user.role !== "rider") {
      router.replace("/(auth)/login");
    }
  }, [user, loading]);

  // Best-effort maintenance check — riders are not blocked but see a banner
  useEffect(() => {
    api
      .get("/settings/maintenance")
      .then((res) => {
        const status = res.data?.data;
        if (status?.enabled) setMaintenance(status);
        else setMaintenance(null);
      })
      .catch(() => {});
  }, []);

  if (loading || !user) return null;

  if (user.role !== "rider") return null;

  return (
    <SocketProvider>
      {maintenance?.enabled && (
        <MaintenanceBanner message={maintenance.message} />
      )}
      <RiderTabs />
    </SocketProvider>
  );
};

const RiderTabs = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#078080",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: theme.fontSize.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ color, size }) => (
            <PackageCheck color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "History",
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

      {/* Hidden screen — per-order customer chat, opened from a delivery card */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
};

export default Layout;
