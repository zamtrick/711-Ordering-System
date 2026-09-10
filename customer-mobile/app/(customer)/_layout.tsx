import { useEffect, useState, useRef } from "react";
import { Tabs, router } from "expo-router";
import { useColorScheme, type ColorValue, ActivityIndicator, Text, StyleSheet, View } from "react-native";
import {
  House,
  ShoppingBag,
  ClipboardList,
  User,
  MessageCircle,
} from "lucide-react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import CartTabIcon from "@/components/CartTabIcon";
import { useSettings } from "@/context/SettingsContext";
import { useSocket, SocketProvider } from "@/context/SocketContext";

const CustomerLayout = () => {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    api
      .get("/auth/me")
      .then((res) => {
        if (!mounted) return;
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

    return () => { mounted = false; };
  }, []);

  if (checking) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={styles.checkingText}>Loading...</Text>
      </ThemedView>
    );
  }

  // Auth confirmed — now safe to mount SocketProvider
  // (the cookie exists so /auth/token will succeed)
  return (
    <SocketProvider>
      <CustomerTabs />
    </SocketProvider>
  );
};

// --------------------------------------------------
// Inner component — uses socket, only mounts after auth
// --------------------------------------------------

const CustomerTabs = () => {
  const systemScheme = useColorScheme();
  const { themePreference } = useSettings();
  const resolvedScheme =
    themePreference === "system" ? systemScheme : themePreference;
  const theme = resolvedScheme === "dark" ? DarkTheme : LightTheme;

  const { socket } = useSocket();

  const [unreadChat, setUnreadChat] = useState(0);
  const convIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Seed the unread badge from the server
    api
      .get("/chat/conversation")
      .then((res) => {
        const convo = res.data?.data;
        if (convo?._id) {
          convIdRef.current = convo._id;
          setUnreadChat(convo.unreadCustomer ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  // Keep badge live via socket
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (convo: { _id?: string; unreadCustomer?: number }) => {
      if (convIdRef.current && convo._id === convIdRef.current) {
        setUnreadChat(convo.unreadCustomer ?? 0);
      }
    };

    socket.on("conversation_updated", handleUpdate);
    return () => { socket.off("conversation_updated", handleUpdate); };
  }, [socket]);

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
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <MessageCircle color={color} size={size} />
              {unreadChat > 0 && (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>
                    {unreadChat > 9 ? "9+" : unreadChat}
                  </Text>
                </View>
              )}
            </View>
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

      {/* Hidden screen — no tab button */}
      <Tabs.Screen
        name="checkout"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      {/* Hidden screen — order detail, no tab button */}
      <Tabs.Screen
        name="orders/[id]"
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

  chatBadge: {
    position: "absolute",
    top: -3,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DA291C",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  chatBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 16,
  },
});

export default CustomerLayout;
