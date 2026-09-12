import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import {
  ChevronLeft,
  MapPin,
  Store,
  PackageSearch,
  RotateCcw,
  Check,
  Circle,
  Truck,
  Star,
  Pencil,
  Printer,
  Share2,
} from "lucide-react-native";
import {
  printReceipt,
  shareReceipt,
  type ReceiptOrder,
} from "@/utils/receipt";
import { router, useLocalSearchParams } from "expo-router";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import ReviewModal from "@/components/ReviewModal";
import api from "@/api/axios";
import { useSocket } from "@/context/SocketContext";
import { useCart } from "@/context/CartContext";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type ServerStatus = "pending" | "processing" | "completed" | "cancelled" | "refunded";

type OrderItem = {
  _id: string;
  quantity: number;
  unitPrice: number;
  subTotal: number;
  product?: { _id?: string; name?: string; price?: number; image?: string };
};

type OrderDetail = {
  _id: string;
  status: ServerStatus;
  deliveryStatus?: "unassigned" | "assigned" | "picked_up" | "in_transit" | "delivered";
  totalAmount: number;
  deliveryFee?: number;
  deliveryAddress?: string;
  createdAt: string;
  updatedAt?: string;
  user?: { firstname?: string; lastname?: string; email?: string } | null;
  branch?: { _id?: string; name?: string; branchCode?: string; location?: string };
  payment?: {
    paymentMethod: string;
    status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  } | null;
  orderItems: OrderItem[];
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

const DELIVERY_LABEL: Record<string, string> = {
  unassigned: "Waiting for rider",
  assigned: "Rider assigned",
  picked_up: "Picked up",
  in_transit: "On the way",
  delivered: "Delivered",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash on Delivery",
  card: "Card",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  pending: "#FF6720",
  paid: "#007A53",
  failed: "#DA291C",
  cancelled: "#DA291C",
  refunded: "#888888",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Ordered timeline steps for active orders — the 4-stage pipeline shown
// live as the admin accepts and the rider delivers.
const TIMELINE_STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "preparing", label: "Preparing your order" },
  { key: "on_delivery", label: "On the way" },
  { key: "completed", label: "Completed" },
] as const;

// Which pipeline step the order is currently on (-1 when terminal)
const activeStepIndex = (
  status: ServerStatus,
  deliveryStatus?: string
): number => {
  if (status === "completed") return 3;
  if (status === "cancelled" || status === "refunded") return -1;
  if (
    status === "processing" &&
    ["assigned", "picked_up", "in_transit", "delivered"].includes(deliveryStatus ?? "")
  ) {
    return 2;
  }
  if (status === "processing") return 1;
  return 0; // pending
};

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { socket } = useSocket();
  const { addItem, clearCart } = useCart();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // Reviews — keyed by productId for the delivered order
  type EligibilityItem = {
    productId: string;
    productName?: string;
    myReview: { rating: number; comment: string } | null;
  };
  const [reviewable, setReviewable] = useState<Record<string, EligibilityItem["myReview"]>>({});
  const [reviewTarget, setReviewTarget] = useState<{
    productId: string;
    name: string;
    rating: number;
    comment: string;
  } | null>(null);

  const [receiptBusy, setReceiptBusy] = useState<"print" | "share" | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data?.data ?? null);
    } catch (err: any) {
      console.log("[OrderDetail] fetch error:", err?.response?.data ?? err?.message);
      if (err?.response?.status === 401) router.replace("/(auth)/login");
      else if (err?.response?.status === 404) setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    fetchOrder();
  }, [fetchOrder]);

  // Load review state once the order is completed + delivered
  const fetchReviewState = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/customer/reviews/eligible/${id}`);
      const data = res.data?.data;
      if (!data?.eligible) return;
      const map: Record<string, EligibilityItem["myReview"]> = {};
      for (const item of data.items ?? []) {
        map[item.productId] = item.myReview;
      }
      setReviewable(map);
    } catch {
      // Non-fatal — review buttons just won't show
    }
  }, [id]);

  // Live updates — server emits `order_updated` to customer:{userId}
  useEffect(() => {
    if (!socket || !id) return;
    const handler = (updated: OrderDetail) => {
      if (updated?._id === id) setOrder(updated);
    };
    socket.on("order_updated", handler);
    return () => {
      socket.off("order_updated", handler);
    };
  }, [socket, id]);

  // Reviews become available once the order is completed + delivered
  useEffect(() => {
    if (order?.status === "completed" && order?.deliveryStatus === "delivered") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on eligibility
      fetchReviewState();
    }
  }, [order?.status, order?.deliveryStatus, fetchReviewState]);

  const handleCancel = () => {
    if (!order) return;
    Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            setCancelling(true);
            const res = await api.patch(`/orders/${order._id}/cancel`);
            if (res.data?.data) setOrder(res.data.data);
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.message ?? "Failed to cancel order.");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleReviewSubmit = async (rating: number, comment: string) => {
    if (!reviewTarget || !order) return;
    try {
      await api.post("/customer/reviews", {
        orderId: order._id,
        productId: reviewTarget.productId,
        rating,
        comment,
      });
      setReviewable((prev) => ({
        ...prev,
        [reviewTarget.productId]: { rating, comment },
      }));
      Alert.alert("Thank you!", "Your review has been saved.");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to save review.");
      throw err;
    }
  };

  const isDelivered = order?.status === "completed" && order?.deliveryStatus === "delivered";

  const buildReceiptOrder = (): ReceiptOrder | null => {
    if (!order) return null;
    return {
      ...order,
      customerName: order.user
        ? `${order.user.firstname} ${order.user.lastname}`
        : undefined,
    };
  };

  const handlePrintReceipt = async () => {
    const receipt = buildReceiptOrder();
    if (!receipt) return;
    setReceiptBusy("print");
    try {
      await printReceipt(receipt);
    } catch {
      Alert.alert("Error", "Could not open the print dialog.");
    } finally {
      setReceiptBusy(null);
    }
  };

  const handleShareReceipt = async () => {
    const receipt = buildReceiptOrder();
    if (!receipt) return;
    setReceiptBusy("share");
    try {
      await shareReceipt(receipt);
    } catch {
      Alert.alert("Error", "Could not generate the receipt.");
    } finally {
      setReceiptBusy(null);
    }
  };

  const handleReorder = () => {
    if (!order || order.orderItems.length === 0) return;
    clearCart();
    for (const item of order.orderItems) {
      const pid =
        typeof item.product === "object" ? item.product?._id : undefined;
      if (!pid) continue;
      addItem({
        id: pid,
        name: item.product?.name ?? "Product",
        category: "Reorder",
        price: item.unitPrice ?? item.product?.price ?? 0,
        image: item.product?.image,
      });
    }
    router.push("/(customer)/cart");
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Loading order…</Text>
      </ThemedView>
    );
  }

  if (!order) {
    return (
      <ThemedView style={styles.centered}>
        <Text style={[styles.errorText, { color: colors.headline }]}>Order not found.</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </Pressable>
      </ThemedView>
    );
  }

  const statusColor = STATUS_COLOR[order.status];
  const statusBg = STATUS_BG[order.status];
  const canCancel = order.status === "pending" || order.status === "processing";
  const isTerminal = order.status === "cancelled" || order.status === "refunded";
  const currentStep = activeStepIndex(order.status, order.deliveryStatus);

  const subtotal = order.orderItems.reduce((s, i) => s + (i.subTotal ?? 0), 0);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <ChevronLeft size={22} color={colors.headline} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.smallTitle, { color: colors.muted }]}>Order tracking</Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              #{order._id.slice(-6).toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABEL[order.status]}</Text>
          </View>
        </View>

        <Text style={[styles.dateText, { color: colors.muted }]}>{formatDate(order.createdAt)}</Text>

        {/* Timeline */}
        {!isTerminal ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {TIMELINE_STEPS.map((step, idx) => {
              const done = idx < currentStep;
              const current = idx === currentStep;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: done || current ? "#007A53" : colors.background,
                          borderColor: done || current ? "#007A53" : colors.border,
                        },
                      ]}
                    >
                      {done && <Check size={12} color="#fff" />}
                      {current && !done && <Circle size={10} color="#FFFFFF" fill="#FFFFFF" />}
                      {!done && !current && <Circle size={10} color={colors.muted} />}
                    </View>
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          { backgroundColor: done ? "#007A53" : colors.border },
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.stepTextWrap}>
                    <Text
                      style={[
                        styles.stepTitle,
                        { color: current ? "#007A53" : done ? colors.headline : colors.muted },
                      ]}
                    >
                      {step.label}
                    </Text>
                    {current && order.deliveryStatus && order.deliveryStatus !== "unassigned" && (
                      <View style={styles.deliveryRow}>
                        <Truck size={12} color={colors.muted} />
                        <Text style={[styles.deliveryText, { color: colors.muted }]}>
                          {DELIVERY_LABEL[order.deliveryStatus] ?? order.deliveryStatus}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.terminalText, { color: statusColor }]}>
              This order was {order.status}.
            </Text>
          </View>
        )}

        {/* Branch + address */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.metaRow}>
            <Store size={16} color="#007A53" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.metaTitle, { color: colors.headline }]}>
                {order.branch?.name ?? "Branch"}
                {order.branch?.branchCode ? `  #${order.branch.branchCode}` : ""}
              </Text>
              {(order.branch as any)?.location && (
                <Text style={[styles.metaSub, { color: colors.muted }]}>{(order.branch as any).location}</Text>
              )}
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.metaRow}>
            <MapPin size={16} color="#007A53" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.metaTitle, { color: colors.headline }]}>Delivery address</Text>
              <Text style={[styles.metaSub, { color: colors.muted }]}>
                {order.deliveryAddress || "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>Items</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {order.orderItems.map((item, idx) => {
            const pid = typeof item.product === "object" ? item.product?._id : undefined;
            const myReview = pid ? reviewable[pid] : undefined;
            return (
              <View key={item._id}>
                <View style={styles.itemRow}>
                  <View style={[styles.thumb, { backgroundColor: colors.background }]}>
                    {item.product?.image ? (
                      <Image source={{ uri: item.product.image }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <PackageSearch size={20} color={colors.muted} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: colors.headline }]} numberOfLines={1}>
                      {item.product?.name ?? "Product"}
                    </Text>
                    <Text style={[styles.itemQty, { color: colors.muted }]}>Qty: {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₱{(item.subTotal ?? 0).toFixed(2)}</Text>
                </View>

                {/* Rate / edit review — delivered orders only */}
                {pid && myReview !== undefined && (
                  <Pressable
                    style={[styles.reviewBtn, { borderColor: colors.border }]}
                    onPress={() =>
                      setReviewTarget({
                        productId: pid,
                        name: item.product?.name ?? "Product",
                        rating: myReview?.rating ?? 0,
                        comment: myReview?.comment ?? "",
                      })
                    }
                  >
                    {myReview ? (
                      <>
                        {[1, 2, 3, 4, 5].map((v) => (
                          <Star
                            key={v}
                            size={13}
                            color={v <= (myReview.rating ?? 0) ? "#FF6720" : colors.border}
                            fill={v <= (myReview.rating ?? 0) ? "#FF6720" : "transparent"}
                          />
                        ))}
                        <Text style={[styles.reviewBtnText, { color: colors.muted }]}>Edit review</Text>
                        <Pencil size={12} color={colors.muted} />
                      </>
                    ) : (
                      <>
                        <Star size={13} color="#FF6720" fill="#FF6720" />
                        <Text style={[styles.reviewBtnText, { color: colors.headline }]}>Rate this product</Text>
                      </>
                    )}
                  </Pressable>
                )}

                {idx < order.orderItems.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {order.payment && (
            <>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.muted }]}>Payment</Text>
                <Text style={[styles.totalValue, { color: colors.headline }]}>
                  {PAYMENT_LABELS[order.payment.paymentMethod] ?? order.payment.paymentMethod}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.muted }]}>Payment Status</Text>
                <Text
                  style={[
                    styles.totalValue,
                    { color: PAYMENT_STATUS_COLOR[order.payment.status] ?? colors.headline, fontWeight: "700" },
                  ]}
                >
                  {PAYMENT_STATUS_LABEL[order.payment.status] ?? order.payment.status}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.muted }]}>Subtotal</Text>
            <Text style={[styles.totalValue, { color: colors.headline }]}>₱{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.muted }]}>Delivery Fee</Text>
            <Text style={[styles.totalValue, { color: colors.headline }]}>
              ₱{(order.deliveryFee ?? 0).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.totalRow}>
            <Text style={[styles.grandLabel, { color: colors.headline }]}>Total</Text>
            <Text style={styles.grandValue}>₱{order.totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Actions */}
        {canCancel && (
          <Pressable
            onPress={handleCancel}
            disabled={cancelling}
            style={[styles.cancelBtn, { opacity: cancelling ? 0.6 : 1 }]}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#DA291C" />
            ) : (
              <Text style={styles.cancelText}>Cancel Order</Text>
            )}
          </Pressable>
        )}
        {/* Receipt actions — delivered orders only, hidden once terminal */}
        {isDelivered && (
          <View style={styles.receiptRow}>
            <Pressable
              onPress={handlePrintReceipt}
              disabled={receiptBusy !== null}
              style={[styles.receiptBtn, { borderColor: colors.border, opacity: receiptBusy ? 0.6 : 1 }]}
            >
              {receiptBusy === "print" ? (
                <ActivityIndicator size="small" color={colors.headline} />
              ) : (
                <>
                  <Printer size={16} color={colors.headline} />
                  <Text style={[styles.receiptText, { color: colors.headline }]}>Print</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleShareReceipt}
              disabled={receiptBusy !== null}
              style={[styles.receiptBtn, styles.receiptBtnPrimary, { opacity: receiptBusy ? 0.6 : 1 }]}
            >
              {receiptBusy === "share" ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Share2 size={16} color="#FFFFFF" />
                  <Text style={[styles.receiptText, { color: "#FFFFFF" }]}>Save PDF / Share</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {(order.status === "completed" || isTerminal) && order.orderItems.length > 0 && (
          <Pressable onPress={handleReorder} style={styles.reorderBtn}>
            <RotateCcw size={18} color="#fff" />
            <Text style={styles.reorderText}>Reorder</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Review modal */}
      <ReviewModal
        visible={reviewTarget !== null}
        productName={reviewTarget?.name ?? ""}
        initialRating={reviewTarget?.rating ?? 0}
        initialComment={reviewTarget?.comment ?? ""}
        onClose={() => setReviewTarget(null)}
        onSubmit={handleReviewSubmit}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 15, fontWeight: "600", marginBottom: 16 },
  retryButton: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#007A53",
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallTitle: { fontSize: 13 },
  title: { fontSize: 24, fontWeight: "800" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  dateText: { fontSize: 12, marginTop: 6, marginBottom: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  stepRow: { flexDirection: "row", gap: 12 },
  stepLeft: { alignItems: "center" },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { width: 2, flex: 1, minHeight: 22, marginVertical: 4 },
  stepTextWrap: { flex: 1, paddingBottom: 18 },
  stepTitle: { fontSize: 14, fontWeight: "700" },
  deliveryRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  deliveryText: { fontSize: 12 },
  terminalText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  metaRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  metaTitle: { fontSize: 13, fontWeight: "700" },
  metaSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  divider: { height: 1, marginVertical: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  thumb: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  itemName: { fontSize: 13, fontWeight: "700" },
  itemQty: { fontSize: 11, marginTop: 3 },
  itemPrice: { fontSize: 14, fontWeight: "800", color: "#007A53" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 13, fontWeight: "600" },
  grandLabel: { fontSize: 16, fontWeight: "800" },
  grandValue: { fontSize: 20, fontWeight: "900", color: "#007A53" },
  cancelBtn: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DA291C",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  cancelText: { color: "#DA291C", fontSize: 14, fontWeight: "700" },
  reorderBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  reorderText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  receiptRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  receiptBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  receiptBtnPrimary: {
    backgroundColor: "#007A53",
    borderWidth: 0,
  },
  receiptText: { fontSize: 13, fontWeight: "700" },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  reviewBtnText: { fontSize: 11, fontWeight: "700", marginLeft: 3 },
});
