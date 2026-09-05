import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  Truck,
  PackageCheck,
  Banknote,
  CircleCheckBig,
  MapPin,
  Clock,
  RotateCcw,
  Check,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/Theme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";

type Stats = {
  activeDeliveries: number;
  completedDeliveries: number;
  totalEarnings: number;
  availabilityStatus: string;
};

type Delivery = {
  _id: string;
  totalAmount: number;
  status: string;
  deliveryStatus: string;
  createdAt: string;
  user?: { firstname: string; lastname: string };
  branch?: { name: string; branchCode: string; location: string };
  orderItems?: { _id: string; quantity: number; product?: { name: string } }[];
};

const Home = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, deliveriesRes] = await Promise.all([
        api.get("/rider/stats"),
        api.get("/rider/deliveries/available"),
      ]);

      if (statsRes.data?.data) setStats(statsRes.data.data);
      if (deliveriesRes.data?.deliveries) setDeliveries(deliveriesRes.data.deliveries);
    } catch (err: any) {
      console.log("Fetch data error:", err);
      if (err?.response?.status === 401) {
        router.replace("/(auth)/login");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleAvailability = async () => {
    if (!stats) return;
    try {
      setTogglingAvailability(true);
      const newStatus = stats.availabilityStatus === "available" ? "offline" : "available";
      const res = await api.patch("/rider/availability", { status: newStatus });
      setStats((prev) =>
        prev ? { ...prev, availabilityStatus: res.data?.data?.availabilityStatus || newStatus } : prev,
      );
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to update status");
    } finally {
      setTogglingAvailability(false);
    }
  };

  const acceptDelivery = async (orderId: string) => {
    try {
      setAcceptingId(orderId);
      await api.patch(`/rider/deliveries/${orderId}/accept`);
      setDeliveries((prev) => prev.filter((d) => d._id !== orderId));
      setStats((prev) =>
        prev ? { ...prev, activeDeliveries: prev.activeDeliveries + 1 } : prev,
      );
      Alert.alert("Success", "Delivery accepted! Go to Deliveries tab to manage it.");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to accept delivery");
    } finally {
      setAcceptingId(null);
    }
  };

  const isAvailable = stats?.availabilityStatus === "available";

  const greetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading...
        </Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.muted }]}>
              {greetingTime()} 👋
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              {user?.firstname || "Rider"}
            </Text>
          </View>

          <Pressable
            onPress={toggleAvailability}
            disabled={togglingAvailability || stats?.availabilityStatus === "delivering"}
            style={[
              styles.availabilityButton,
              {
                backgroundColor: isAvailable ? "#E8F5EF" : colors.surface,
                borderColor: isAvailable ? "#007A53" : colors.border,
                opacity: stats?.availabilityStatus === "delivering" ? 0.5 : 1,
              },
            ]}
          >
            {togglingAvailability ? (
              <ActivityIndicator size="small" color="#007A53" />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: isAvailable ? "#007A53" : "#888" }]} />
            )}
            <Text
              style={[
                styles.availabilityText,
                { color: isAvailable ? "#007A53" : colors.muted },
              ]}
            >
              {isAvailable ? "Online" : stats?.availabilityStatus === "delivering" ? "Delivering" : "Offline"}
            </Text>
          </Pressable>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: "#E8F5EF" }]}>
              <Truck size={20} color="#007A53" />
            </View>
            <Text style={[styles.statValue, { color: colors.headline }]}>
              {stats?.activeDeliveries ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Active</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: "#FFF3E8" }]}>
              <CircleCheckBig size={20} color="#FF6720" />
            </View>
            <Text style={[styles.statValue, { color: colors.headline }]}>
              {stats?.completedDeliveries ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Completed</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: "#F0F7FF" }]}>
              <Banknote size={20} color="#007A53" />
            </View>
            <Text style={[styles.statValue, { color: colors.headline }]}>
              ₱{(stats?.totalEarnings ?? 0).toFixed(0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Earnings</Text>
          </View>
        </View>

        {/* Available Deliveries */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>
            Available Deliveries
          </Text>
          <Text style={[styles.count, { color: colors.muted }]}>
            {deliveries.length}
          </Text>
        </View>

        {deliveries.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PackageCheck size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              No deliveries available
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {isAvailable
                ? "Stay online and wait for new orders"
                : "Go online to receive deliveries"}
            </Text>
          </View>
        ) : (
          deliveries.map((delivery) => {
            const accepting = acceptingId === delivery._id;
            return (
              <View
                key={delivery._id}
                style={[styles.deliveryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.deliveryHeader}>
                  <View>
                    <Text style={[styles.orderId, { color: colors.headline }]}>
                      #{delivery._id.slice(-6).toUpperCase()}
                    </Text>
                    <Text style={[styles.orderTime, { color: colors.muted }]}>
                      {new Date(delivery.createdAt).toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.orderTotal, { color: "#007A53" }]}>
                    ₱{delivery.totalAmount.toFixed(2)}
                  </Text>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                {/* Customer */}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>Customer</Text>
                  <Text style={[styles.infoValue, { color: colors.headline }]}>
                    {delivery.user?.firstname} {delivery.user?.lastname}
                  </Text>
                </View>

                {/* Branch */}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>Branch</Text>
                  <Text style={[styles.infoValue, { color: colors.headline }]}>
                    {delivery.branch?.name}
                  </Text>
                </View>

                {/* Items count */}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>Items</Text>
                  <Text style={[styles.infoValue, { color: colors.headline }]}>
                    {delivery.orderItems?.length ?? 0} item(s)
                  </Text>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                {/* Accept Button */}
                <Pressable
                  onPress={() => acceptDelivery(delivery._id)}
                  disabled={accepting || !isAvailable}
                  style={[
                    styles.acceptButton,
                    {
                      opacity: accepting || !isAvailable ? 0.6 : 1,
                    },
                  ]}
                >
                  {accepting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={18} color="#FFFFFF" />
                      <Text style={styles.acceptButtonText}>Accept Delivery</Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  content: {
    padding: 20,
    paddingBottom: 35,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
  },

  availabilityButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  availabilityText: {
    fontSize: 13,
    fontWeight: "700",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },

  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },

  statLabel: {
    fontSize: 11,
    marginTop: 3,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  count: {
    fontSize: 14,
    fontWeight: "600",
  },

  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
  },

  emptyText: {
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },

  deliveryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  orderId: {
    fontSize: 15,
    fontWeight: "800",
  },

  orderTime: {
    fontSize: 11,
    marginTop: 3,
  },

  orderTotal: {
    fontSize: 17,
    fontWeight: "900",
  },

  separator: {
    height: 1,
    marginVertical: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  infoLabel: {
    fontSize: 12,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  acceptButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default Home;
