import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from "react-native";
import {
  PackageCheck,
  MapPin,
  ChevronRight,
  CircleCheckBig,
  Truck,
  Package,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/Theme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import { router } from "expo-router";
import { useSocket } from "@/context/SocketContext";

type Delivery = {
  _id: string;
  totalAmount: number;
  status: string;
  deliveryStatus: string;
  rider?: string | { _id?: string };
  createdAt: string;
  user?: { firstname: string; lastname: string; email: string };
  branch?: {
    name: string;
    branchCode: string;
    location: string;
    address?:
      | string
      | {
          street?: string;
          barangay?: string;
          city?: string;
          province?: string;
          postalCode?: string;
        };
  };
  orderItems?: {
    _id: string;
    quantity: number;
    product?: { name: string; price: number };
  }[];
};

const DELIVERY_STATUS: Record<string, { label: string; color: string; bg: string; next: string | null }> = {
  assigned: { label: "Assigned", color: "#FF6720", bg: "#FFF3E8", next: "picked_up" },
  picked_up: { label: "Picked Up", color: "#007A53", bg: "#E8F5EF", next: "in_transit" },
  in_transit: { label: "In Transit", color: "#007A53", bg: "#E8F5EF", next: "delivered" },
  delivered: { label: "Delivered", color: "#007A53", bg: "#E8F5EF", next: null },
};

const NEXT_LABEL: Record<string, string> = {
  picked_up: "Mark as Picked Up",
  in_transit: "Start Delivery",
  delivered: "Mark as Delivered",
};

const NEXT_ICON: Record<string, string> = {
  picked_up: "📦",
  in_transit: "🚚",
  delivered: "✅",
};

// Branch.address is a structured object on the server
// ({street, barangay, city, province, postalCode}). Older clients used to
// treat it as a plain string, so this formatter handles both shapes and
// skips empty parts.
const formatBranchAddress = (
  address:
    | string
    | {
        street?: string;
        barangay?: string;
        city?: string;
        province?: string;
        postalCode?: string;
      }
    | undefined
): string => {
  if (!address) return "";
  if (typeof address === "string") return address;

  return [address.street, address.barangay, address.city, address.province, address.postalCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
};

const Deliveries = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { socket, connected } = useSocket();
  const myRiderIdRef = useRef<string | null>(null);

  // Resolve my rider document id once so socket events can tell
  // assignments to me apart from other riders' pickups.
  useEffect(() => {
    api
      .get("/rider/profile/me")
      .then((res) => {
        myRiderIdRef.current = res.data?.data?._id ?? null;
      })
      .catch(() => {});
  }, []);

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/rider/deliveries/mine");
      setDeliveries(res.data?.deliveries ?? []);
    } catch (err: any) {
      console.log("Fetch deliveries error:", err);
      if (err?.response?.status === 401) {
        router.replace("/(auth)/login");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    fetchDeliveries();
  }, [fetchDeliveries]);

  // Live: status changes merge in place; delivered/cancelled orders drop
  // off; orders newly assigned to me appear without refetching.
  useEffect(() => {
    if (!socket) return;
    const handler = (updated: Delivery) => {
      if (!updated?._id) return;
      const ACTIVE = ["assigned", "picked_up", "in_transit"];
      const rawRider =
        typeof updated.rider === "object" ? updated.rider?._id : updated.rider;
      const assignedToMe =
        rawRider != null && myRiderIdRef.current != null
          ? rawRider.toString() === myRiderIdRef.current.toString()
          : false;
      const gone =
        updated.deliveryStatus === "delivered" ||
        updated.status === "cancelled" ||
        updated.status === "refunded" ||
        updated.status === "completed";

      setDeliveries((prev) => {
        const exists = prev.some((d) => d._id === updated._id);
        if (exists) {
          if (gone) return prev.filter((d) => d._id !== updated._id);
          return prev.map((d) => (d._id === updated._id ? { ...d, ...updated } : d));
        }
        if (!gone && assignedToMe && ACTIVE.includes(updated.deliveryStatus)) {
          return [updated, ...prev];
        }
        return prev;
      });
    };
    socket.on("order_updated", handler);
    return () => {
      socket.off("order_updated", handler);
    };
  }, [socket]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const labels: Record<string, string> = {
      picked_up: "picked up",
      in_transit: "in transit",
      delivered: "delivered",
    };

    Alert.alert(
      "Confirm Update",
      `Mark this delivery as ${labels[newStatus]}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setUpdatingId(orderId);
              await api.patch(`/rider/deliveries/${orderId}/status`, {
                deliveryStatus: newStatus,
              });

              if (newStatus === "delivered") {
                setDeliveries((prev) => prev.filter((d) => d._id !== orderId));
              } else {
                setDeliveries((prev) =>
                  prev.map((d) =>
                    d._id === orderId ? { ...d, deliveryStatus: newStatus } : d,
                  ),
                );
              }
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to update status");
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ],
    );
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading deliveries...
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
            <Text style={[styles.smallTitle, { color: colors.muted }]}>
              Your assigned orders {connected ? "· Live" : "· Offline"}
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              My Deliveries
            </Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PackageCheck size={21} color="#007A53" />
            <View
              style={[
                styles.liveDotBadge,
                { backgroundColor: connected ? "#007A53" : "#999" },
              ]}
            />
          </View>
        </View>

        {/* Deliveries */}
        {deliveries.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Truck size={42} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              No active deliveries
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Accept a delivery from the Home tab to get started
            </Text>
          </View>
        ) : (
          deliveries.map((delivery) => {
            const statusInfo = DELIVERY_STATUS[delivery.deliveryStatus] || DELIVERY_STATUS.assigned;
            const nextStatus = statusInfo.next;
            const updating = updatingId === delivery._id;

            return (
              <View
                key={delivery._id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={[styles.orderId, { color: colors.headline }]}>
                      #{delivery._id.slice(-6).toUpperCase()}
                    </Text>
                    <Text style={[styles.orderDate, { color: colors.muted }]}>
                      {formatDate(delivery.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
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
                  <View style={styles.infoLabelRow}>
                    <MapPin size={14} color={colors.muted} />
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Branch</Text>
                  </View>
                  <Text style={[styles.infoValue, { color: colors.headline }]}>
                    {delivery.branch?.name}
                  </Text>
                </View>

                {/* Address */}
                {formatBranchAddress(delivery.branch?.address) ? (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Address</Text>
                    <Text style={[styles.infoValue, { color: colors.headline }]} numberOfLines={2}>
                      {formatBranchAddress(delivery.branch?.address)}
                    </Text>
                  </View>
                ) : null}

                {/* Items */}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>Items</Text>
                  <Text style={[styles.infoValue, { color: colors.headline }]}>
                    {delivery.orderItems?.length ?? 0} item(s)
                  </Text>
                </View>

                {/* Total */}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: "#007A53" }]}>
                    ₱{delivery.totalAmount.toFixed(2)}
                  </Text>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                {/* Next Action Button */}
                {nextStatus && (
                  <Pressable
                    onPress={() => updateStatus(delivery._id, nextStatus)}
                    disabled={updating}
                    style={[
                      styles.actionButton,
                      { opacity: updating ? 0.6 : 1 },
                    ]}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.actionIcon}>{NEXT_ICON[nextStatus]}</Text>
                        <Text style={styles.actionText}>{NEXT_LABEL[nextStatus]}</Text>
                        <ChevronRight size={18} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                )}
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

  smallTitle: {
    fontSize: 14,
    marginBottom: 3,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
  },

  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  liveDotBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  orderId: {
    fontSize: 15,
    fontWeight: "800",
  },

  orderDate: {
    fontSize: 11,
    marginTop: 3,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  separator: {
    height: 1,
    marginVertical: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  infoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  infoLabel: {
    fontSize: 12,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },

  totalValue: {
    fontSize: 17,
    fontWeight: "900",
  },

  actionButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  actionIcon: {
    fontSize: 16,
  },

  actionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  emptyContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 14,
  },

  emptyText: {
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 250,
    lineHeight: 19,
  },
});

export default Deliveries;
