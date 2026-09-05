import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import {
  ClipboardList,
  PackageCheck,
  CheckCircle,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/Theme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import { router } from "expo-router";

type Delivery = {
  _id: string;
  totalAmount: number;
  status: string;
  deliveryStatus: string;
  updatedAt: string;
  user?: { firstname: string; lastname: string };
  branch?: { name: string; branchCode: string };
  orderItems?: { _id: string; quantity: number; product?: { name: string; price: number } }[];
};

const History = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/rider/deliveries/history");
      setDeliveries(res.data?.deliveries ?? []);
    } catch (err: any) {
      console.log("Fetch history error:", err);
      if (err?.response?.status === 401) {
        router.replace("/(auth)/login");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric",
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
          Loading history...
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
              Your completed deliveries
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              Delivery History
            </Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ClipboardList size={21} color="#007A53" />
          </View>
        </View>

        {/* History */}
        {deliveries.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PackageCheck size={42} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              No delivery history
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Completed deliveries will appear here
            </Text>
          </View>
        ) : (
          deliveries.map((delivery) => (
            <View
              key={delivery._id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.orderId, { color: colors.headline }]}>
                    #{delivery._id.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={[styles.orderDate, { color: colors.muted }]}>
                    {formatDate(delivery.updatedAt)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: "#E8F5EF" }]}>
                  <CheckCircle size={14} color="#007A53" />
                  <Text style={[styles.statusText, { color: "#007A53" }]}>
                    Delivered
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
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Branch</Text>
                <Text style={[styles.infoValue, { color: colors.headline }]}>
                  {delivery.branch?.name}
                </Text>
              </View>

              {/* Items */}
              {delivery.orderItems && delivery.orderItems.length > 0 && (
                <View style={styles.itemsContainer}>
                  {delivery.orderItems.map((item) => (
                    <View key={item._id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.itemName, { color: colors.headline }]} numberOfLines={1}>
                        {item.product?.name ?? "Product"}
                      </Text>
                      <Text style={[styles.itemQty, { color: colors.muted }]}>
                        x{item.quantity}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={[styles.separator, { backgroundColor: colors.border }]} />

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.muted }]}>Total</Text>
                <Text style={[styles.totalValue, { color: "#007A53" }]}>
                  ₱{delivery.totalAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          ))
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
    marginBottom: 8,
  },

  infoLabel: {
    fontSize: 12,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  itemsContainer: {
    marginTop: 4,
  },

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
  },

  itemName: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  itemQty: {
    fontSize: 12,
    marginLeft: 10,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  totalLabel: {
    fontSize: 13,
  },

  totalValue: {
    fontSize: 18,
    fontWeight: "900",
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

export default History;
