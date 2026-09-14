import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import {
  ClipboardList,
  ChevronRight,
  RotateCcw,
  PackageCheck,
} from "lucide-react-native";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import { router, useFocusEffect } from "expo-router";
import { useSocket } from "@/context/SocketContext";
import api from "@/api/axios";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type ServerStatus = "pending" | "processing" | "completed" | "cancelled" | "refunded";

type Order = {
  _id: string;
  status: ServerStatus;
  deliveryStatus?: "unassigned" | "assigned" | "picked_up" | "in_transit" | "delivered";
  totalAmount: number;
  createdAt: string;
  rider?: {
    _id?: string;
    phone?: string;
    vehicleType?: string;
    vehiclePlateNumber?: string;
    user?: { firstname?: string; lastname?: string } | null;
  } | string | null;
  orderItems: {
    _id: string;
    quantity: number;
    product?: { name: string; image?: string };
  }[];
  deliveryFee?: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

// --------------------------------------------------
// LIVE STAGE — the 5-step pipeline shown on each order card
// --------------------------------------------------

const STAGES = ["placed", "preparing", "assigned", "picked_up", "in_transit", "completed"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  placed: "Order placed",
  preparing: "Preparing your order",
  assigned: "Rider assigned",
  picked_up: "Picked up",
  in_transit: "On the way",
  completed: "Completed",
};

const orderStage = (
  status: ServerStatus,
  deliveryStatus?: string
): Stage | null => {
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "refunded") return null; // terminal — no pipeline
  if (status === "processing") {
    switch (deliveryStatus) {
      case "assigned":
        return "assigned";
      case "picked_up":
        return "picked_up";
      case "in_transit":
        return "in_transit";
      case "delivered":
        return "completed";
      default:
        return "preparing";
    }
  }
  return "placed";
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

// Filter values map to the server's ?status= values
const FILTERS: { label: string; value: "all" | ServerStatus }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
];

const PAGE_SIZE = 10;

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const Orders = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  const [selectedFilter, setSelectedFilter] = useState<"all" | ServerStatus>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { socket } = useSocket();

  // Guards so flat list doesn't double-fetch while a request is in flight
  const fetchingRef = useRef(false);
  const endReachedRef = useRef(false);

  // --------------------------------------------------
  // FETCH PAGE 1 (filter change / focus / pull-to-refresh)
  // --------------------------------------------------

  const fetchOrders = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        if (!opts?.silent) setLoading(true);
        const params: Record<string, string | number> = { page: 1, limit: PAGE_SIZE };
        if (selectedFilter !== "all") params.status = selectedFilter;

        const response = await api.get("/orders", { params });
        const list: Order[] = response.data?.orders ?? [];
        setOrders(list);
        setPagination(response.data?.pagination ?? null);
        setPage(1);
        endReachedRef.current = !(response.data?.pagination?.hasMore ?? false);
      } catch (err: any) {
        console.log("[Orders] FETCH ERROR:", err?.response?.status, err?.response?.data ?? err?.message);
        if (err?.response?.status === 401) {
          router.replace("/(auth)/login");
        }
      } finally {
        fetchingRef.current = false;
        if (!opts?.silent) setLoading(false);
      }
    },
    [selectedFilter],
  );

  // Re-fetch whenever the status filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch on filter change
    fetchOrders();
  }, [fetchOrders]);

  // Refresh when the screen regains focus (freshly placed order shows up)
  useFocusEffect(
    useCallback(() => {
      fetchOrders({ silent: orders.length > 0 });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- orders.length is just a hint
    }, [fetchOrders]),
  );

  // --------------------------------------------------
  // LOAD MORE (infinite scroll)
  // --------------------------------------------------

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || endReachedRef.current) return;
    if (!pagination?.hasMore) return;

    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params: Record<string, string | number> = { page: nextPage, limit: PAGE_SIZE };
      if (selectedFilter !== "all") params.status = selectedFilter;

      const response = await api.get("/orders", { params });
      const list: Order[] = response.data?.orders ?? [];

      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o._id));
        const fresh = list.filter((o) => !seen.has(o._id));
        return [...prev, ...fresh];
      });
      setPagination(response.data?.pagination ?? null);
      setPage(nextPage);
      endReachedRef.current = !(response.data?.pagination?.hasMore ?? false);
    } catch (err: any) {
      console.log("[Orders] LOAD MORE ERROR:", err?.response?.status, err?.message);
      // Don't lock the user out — allow retry on next scroll
      endReachedRef.current = false;
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [page, pagination?.hasMore, selectedFilter]);

  // --------------------------------------------------
  // LIVE STATUS UPDATES
  // --------------------------------------------------

  useEffect(() => {
    if (!socket) return;
    const handler = (updated: Order) => {
      if (!updated?._id) return;
      setOrders((prev) => {
        const exists = prev.some((o) => o._id === updated._id);
        if (!exists) return [updated, ...prev];
        return prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o));
      });
    };
    // Live updates merge into the currently loaded pages — good enough for
    // status tracking; a fresh pull-to-refresh reloads page 1 cleanly.
    socket.on("order_updated", handler);
    return () => {
      socket.off("order_updated", handler);
    };
  }, [socket]);

  // --------------------------------------------------
  // PULL TO REFRESH
  // --------------------------------------------------

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders({ silent: true }).finally(() => setRefreshing(false));
  }, [fetchOrders]);

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
            setOrders((prev) =>
              prev.map((o) =>
                o._id === orderId
                  ? { ...o, status: "cancelled", rider: null, deliveryStatus: "unassigned" }
                  : o,
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
  // RENDER ORDER CARD
  // --------------------------------------------------

  const renderOrder = useCallback(
    ({ item }: { item: Order }) => {
      const statusColor = STATUS_COLOR[item.status] ?? "#888888";
      const statusBg = STATUS_BG[item.status] ?? "#F0F0F0";
      const cancelling = cancellingId === item._id;
      const canCancel =
        item.status === "pending" || item.status === "processing";
      const stage = orderStage(item.status, item.deliveryStatus);
      const stageIndex = stage ? STAGES.indexOf(stage) : -1;
      const displayStage =
        item.status === "completed" && item.deliveryStatus === "delivered" ? "completed" : stage;

      return (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(customer)/orders/[id]",
              params: { id: item._id },
            })
          }
          style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {/* Order Header */}
          <View style={styles.orderHeader}>
            <View>
              <Text style={[styles.orderId, { color: colors.headline }]}>
                #{(item._id ?? "").slice(-6).toUpperCase() || "—"}
              </Text>
              <Text style={[styles.orderDate, { color: colors.muted }]}>
                {formatDate(item.createdAt)}
              </Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABEL[item.status] ?? item.status ?? "Unknown"}
              </Text>
            </View>
          </View>

          {/* Live pipeline */}
          {displayStage && (
            <View style={styles.pipeline}>
              {STAGES.map((s, i) => {
                const done = i < stageIndex;
                const current = i === stageIndex;
                return (
                  <View key={s} style={styles.pipelineStep}>
                    <View
                      style={[
                        styles.pipelineDot,
                        { backgroundColor: done || current ? "#007A53" : colors.border },
                      ]}
                    />
                    {i < STAGES.length - 1 && (
                      <View
                        style={[
                          styles.pipelineLine,
                          { backgroundColor: done ? "#007A53" : colors.border },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
          {displayStage && (
            <Text style={[styles.stageLabel, { color: colors.muted }]}>
              {STAGE_LABEL[displayStage]}
              {typeof item.rider === "object" &&
                item.rider !== null &&
                item.rider.user &&
                ` • ${`${item.rider.user.firstname ?? ""} ${item.rider.user.lastname ?? ""}`.trim()}`}
            </Text>
          )}

          {/* Items */}
          {(item.orderItems ?? []).length > 0 && (
            <>
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              <View style={styles.items}>
                {(item.orderItems ?? []).slice(0, 3).map((orderItem) => (
                  <View key={orderItem._id} style={styles.item}>
                    <View style={[styles.itemImage, { backgroundColor: colors.background }]}>
                      <Text style={styles.itemEmoji}>📦</Text>
                    </View>
                    <View style={styles.itemDetails}>
                      <Text style={[styles.itemName, { color: colors.headline }]} numberOfLines={1}>
                        {orderItem.product?.name ?? "Product"}
                      </Text>
                      <Text style={[styles.itemQuantity, { color: colors.muted }]}>
                        Qty: {orderItem.quantity}
                      </Text>
                    </View>
                  </View>
                ))}
                {(item.orderItems ?? []).length > 3 && (
                  <Text style={[styles.moreItems, { color: colors.muted }]}>
                    +{(item.orderItems ?? []).length - 3} more item(s)
                  </Text>
                )}
              </View>
            </>
          )}

          {/* Bottom */}
          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.orderBottom}>
            <View>
              <Text style={[styles.totalLabel, { color: colors.muted }]}>
                {(item.deliveryFee ?? 0) > 0
                  ? `Total (incl. ₱${(item.deliveryFee ?? 0).toFixed(2)} delivery)`
                  : "Total"}
              </Text>
              <Text style={[styles.total, { color: "#007A53" }]}>
                ₱{(item.totalAmount ?? 0).toFixed(2)}
              </Text>
            </View>

            {item.status === "completed" ? (
              <Pressable
                style={[styles.actionButton, { borderColor: "#007A53" }]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push({
                    pathname: "/(customer)/orders/[id]",
                    params: { id: item._id },
                  });
                }}
              >
                <RotateCcw size={16} color="#007A53" />
                <Text style={[styles.actionText, { color: "#007A53" }]}>Reorder</Text>
              </Pressable>
            ) : canCancel ? (
              <Pressable
                style={[
                  styles.actionButton,
                  { borderColor: "#DA291C", opacity: cancelling ? 0.6 : 1 },
                ]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleCancel(item._id);
                }}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#DA291C" />
                ) : (
                  <Text style={[styles.actionText, { color: "#DA291C" }]}>Cancel</Text>
                )}
              </Pressable>
            ) : (
              <View style={styles.viewOrder}>
                <Text style={[styles.viewOrderText, { color: "#007A53" }]}>View details</Text>
                <ChevronRight size={17} color="#007A53" />
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [colors, cancellingId],
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
      <FlatList
        data={orders}
        keyExtractor={(o) => o._id}
        renderItem={renderOrder}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        // Load the next page when the user scrolls near the bottom
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007A53"
            colors={["#007A53"]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.smallTitle, { color: colors.muted }]}>
                  Track your purchases
                </Text>
                <Text style={[styles.title, { color: colors.headline }]}>My Orders</Text>
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
                const active = selectedFilter === filter.value;
                return (
                  <Pressable
                    key={filter.label}
                    onPress={() => setSelectedFilter(filter.value)}
                    style={[
                      styles.filterButton,
                      {
                        backgroundColor: active ? "#007A53" : colors.surface,
                        borderColor: active ? "#007A53" : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.filterText, { color: active ? "#FFFFFF" : colors.headline }]}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#007A53" />
              <Text style={[styles.footerText, { color: colors.muted }]}>Loading more…</Text>
            </View>
          ) : pagination && !pagination.hasMore && orders.length > 0 ? (
            <View style={styles.footerLoader}>
              <Text style={[styles.footerText, { color: colors.muted }]}>
                {pagination.total} order{pagination.total === 1 ? "" : "s"} total
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <PackageCheck size={42} color="#007A53" />
            </View>

            <Text style={[styles.emptyTitle, { color: colors.headline }]}>No orders found</Text>

            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {selectedFilter === "all"
                ? "You haven't placed any orders yet."
                : `No ${selectedFilter.toLowerCase()} orders.`}
            </Text>

            {selectedFilter === "all" && (
              <Pressable
                onPress={() => router.push("/(customer)/products")}
                style={[styles.shopButton, { backgroundColor: "#007A53" }]}
              >
                <Text style={styles.shopButtonText}>Start Shopping</Text>
              </Pressable>
            )}
          </View>
        }
      />
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

  orderCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 13,
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

  pipeline: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },

  pipelineStep: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  pipelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  pipelineLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
    borderRadius: 1,
  },

  stageLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
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

  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
  },

  footerText: {
    fontSize: 12,
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
