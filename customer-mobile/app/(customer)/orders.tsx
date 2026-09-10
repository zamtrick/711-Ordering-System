import { useState, useCallback } from "react";
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
  ClipboardList,
  ChevronRight,
  RotateCcw,
  PackageCheck,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import api from "@/api/axios";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type ServerStatus = "pending" | "processing" | "completed" | "cancelled" | "refunded";

type Order = {
  _id: string;
  status: ServerStatus;
  totalAmount: number;
  createdAt: string;
  orderItems: {
    _id: string;
    quantity: number;
    product?: { name: string; image?: string };
  }[];
  deliveryFee?: number;
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const STATUS_LABEL: Record<ServerStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_COLOR: Record<ServerStatus, string> = {
  pending: "#FF6720",
  processing: "#FF6720",
  completed: "#007A53",
  cancelled: "#DA291C",
  refunded: "#888888",
};

const STATUS_BG: Record<ServerStatus, string> = {
  pending: "#FFF3E8",
  processing: "#FFF3E8",
  completed: "#E8F5EF",
  cancelled: "#FFF0F0",
  refunded: "#F0F0F0",
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const FILTERS = ["All", "Pending", "Processing", "Completed", "Cancelled", "Refunded"];

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const Orders = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [selectedFilter, setSelectedFilter] = useState("All");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // --------------------------------------------------
  // FETCH ORDERS
  // --------------------------------------------------

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      console.log("[Orders] Fetching GET /orders...");
      const response = await api.get("/orders");
      console.log("[Orders] Response status:", response.status);
      console.log("[Orders] Response data keys:", Object.keys(response.data ?? {}));
      console.log("[Orders] orders array length:", (response.data?.orders ?? []).length);
      console.log("[Orders] Full response:", JSON.stringify(response.data));
      setOrders(response.data?.orders ?? []);
    } catch (err: any) {
      console.log("[Orders] FETCH ERROR:", err?.response?.status, err?.response?.data ?? err?.message);
      if (err?.response?.status === 401) {
        router.replace("/(auth)/login");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch every time this screen comes into focus so a freshly placed
  // order shows up immediately without requiring a manual refresh.
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  // --------------------------------------------------
  // CANCEL ORDER
  // --------------------------------------------------

  const handleCancel = (orderId: string) => {
    Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            setCancellingId(orderId);
            await api.patch(`/orders/${orderId}/cancel`);
            // Update local state immediately
            setOrders((prev) =>
              prev.map((o) =>
                o._id === orderId ? { ...o, status: "cancelled" } : o,
              ),
            );
          } catch (err: any) {
            const msg =
              err?.response?.data?.message ?? "Failed to cancel order.";
            Alert.alert("Error", msg);
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  // --------------------------------------------------
  // FILTER
  // --------------------------------------------------

  const filtered =
    selectedFilter === "All"
      ? orders
      : orders.filter(
          (o) =>
            STATUS_LABEL[o.status].toLowerCase() ===
            selectedFilter.toLowerCase(),
        );

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading orders...
        </Text>
      </ThemedView>
    );
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

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
              Track your purchases
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              My Orders
            </Text>
          </View>

          <View
            style={[
              styles.headerIcon,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ClipboardList size={21} color="#007A53" />
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        >
          {FILTERS.map((filter) => {
            const active = selectedFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: active ? "#007A53" : colors.surface,
                    borderColor: active ? "#007A53" : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? "#FFFFFF" : colors.headline },
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Orders */}
        <View style={styles.ordersContainer}>
          {filtered.map((order) => {
            const statusColor = STATUS_COLOR[order.status];
            const statusBg = STATUS_BG[order.status];
            const cancelling = cancellingId === order._id;
            const canCancel =
              order.status === "pending" || order.status === "processing";

            return (
              <View
                key={order._id}
                style={[
                  styles.orderCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {/* Order Header */}
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={[styles.orderId, { color: colors.headline }]}>
                      #{order._id.slice(-6).toUpperCase()}
                    </Text>
                    <Text style={[styles.orderDate, { color: colors.muted }]}>
                      {formatDate(order.createdAt)}
                    </Text>
                  </View>

                  <View
                    style={[styles.statusBadge, { backgroundColor: statusBg }]}
                  >
                    <View
                      style={[styles.statusDot, { backgroundColor: statusColor }]}
                    />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {STATUS_LABEL[order.status]}
                    </Text>
                  </View>
                </View>

                {/* Items */}
                {order.orderItems.length > 0 && (
                  <>
                    <View
                      style={[
                        styles.separator,
                        { backgroundColor: colors.border },
                      ]}
                    />

                    <View style={styles.items}>
                      {order.orderItems.slice(0, 3).map((item) => (
                        <View key={item._id} style={styles.item}>
                          <View
                            style={[
                              styles.itemImage,
                              { backgroundColor: colors.background },
                            ]}
                          >
                            <Text style={styles.itemEmoji}>📦</Text>
                          </View>

                          <View style={styles.itemDetails}>
                            <Text
                              style={[
                                styles.itemName,
                                { color: colors.headline },
                              ]}
                              numberOfLines={1}
                            >
                              {item.product?.name ?? "Product"}
                            </Text>
                            <Text
                              style={[
                                styles.itemQuantity,
                                { color: colors.muted },
                              ]}
                            >
                              Qty: {item.quantity}
                            </Text>
                          </View>
                        </View>
                      ))}

                      {order.orderItems.length > 3 && (
                        <Text style={[styles.moreItems, { color: colors.muted }]}>
                          +{order.orderItems.length - 3} more item(s)
                        </Text>
                      )}
                    </View>
                  </>
                )}

                {/* Bottom */}
                <View
                  style={[styles.separator, { backgroundColor: colors.border }]}
                />

                <View style={styles.orderBottom}>
                  <View>
                    <Text style={[styles.totalLabel, { color: colors.muted }]}>
                      {(order.deliveryFee ?? 0) > 0
                        ? `Total (incl. ₱${(order.deliveryFee ?? 0).toFixed(2)} delivery)`
                        : "Total"}
                    </Text>
                    <Text style={[styles.total, { color: "#007A53" }]}>
                      ₱{order.totalAmount.toFixed(2)}
                    </Text>
                  </View>

                  {order.status === "completed" ? (
                    <Pressable
                      style={[styles.actionButton, { borderColor: "#007A53" }]}
                      onPress={() => router.push("/(customer)/products")}
                    >
                      <RotateCcw size={16} color="#007A53" />
                      <Text style={[styles.actionText, { color: "#007A53" }]}>
                        Reorder
                      </Text>
                    </Pressable>
                  ) : canCancel ? (
                    <Pressable
                      style={[
                        styles.actionButton,
                        {
                          borderColor: "#DA291C",
                          opacity: cancelling ? 0.6 : 1,
                        },
                      ]}
                      onPress={() => handleCancel(order._id)}
                      disabled={cancelling}
                    >
                      {cancelling ? (
                        <ActivityIndicator size="small" color="#DA291C" />
                      ) : (
                        <>
                          <Text
                            style={[styles.actionText, { color: "#DA291C" }]}
                          >
                            Cancel
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <View style={styles.viewOrder}>
                      <Text style={[styles.viewOrderText, { color: "#007A53" }]}>
                        {STATUS_LABEL[order.status]}
                      </Text>
                      <ChevronRight size={17} color="#007A53" />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Empty State */}
        {filtered.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <PackageCheck size={42} color="#007A53" />
            </View>

            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              No orders found
            </Text>

            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {selectedFilter === "All"
                ? "You haven't placed any orders yet."
                : `No ${selectedFilter.toLowerCase()} orders.`}
            </Text>

            {selectedFilter === "All" && (
              <Pressable
                onPress={() => router.push("/(customer)/products")}
                style={[styles.shopButton, { backgroundColor: "#007A53" }]}
              >
                <Text style={styles.shopButtonText}>Start Shopping</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
};

// --------------------------------------------------
// STYLES
// --------------------------------------------------

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

  filterList: {
    gap: 9,
    paddingBottom: 22,
  },

  filterButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  filterText: {
    fontSize: 13,
    fontWeight: "600",
  },

  ordersContainer: {
    gap: 13,
  },

  orderCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },

  orderHeader: {
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
    marginTop: 4,
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
    marginVertical: 13,
  },

  items: {
    gap: 10,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
  },

  itemImage: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  itemEmoji: {
    fontSize: 22,
  },

  itemDetails: {
    flex: 1,
    marginLeft: 10,
  },

  itemName: {
    fontSize: 13,
    fontWeight: "700",
  },

  itemQuantity: {
    fontSize: 11,
    marginTop: 3,
  },

  moreItems: {
    fontSize: 11,
    marginLeft: 56,
  },

  orderBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  totalLabel: {
    fontSize: 11,
  },

  total: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },

  actionButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  actionText: {
    fontSize: 12,
    fontWeight: "700",
  },

  viewOrder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  viewOrderText: {
    fontSize: 12,
    fontWeight: "700",
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 70,
  },

  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  emptyText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 270,
    lineHeight: 19,
  },

  shopButton: {
    marginTop: 20,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  shopButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default Orders;
