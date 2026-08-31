import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
} from "react-native";
import {
  ClipboardList,
  ChevronRight,
  RotateCcw,
  PackageCheck,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";

type OrderStatus = "Completed" | "Preparing" | "Ready" | "Cancelled";

const Orders = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [selectedFilter, setSelectedFilter] = useState("All");

  const filters = ["All", "Preparing", "Ready", "Completed", "Cancelled"];

  const orders: {
    id: string;
    date: string;
    status: OrderStatus;
    total: number;
    items: {
      name: string;
      quantity: number;
      emoji: string;
    }[];
  }[] = [
    {
      id: "#ORD-1024",
      date: "Today, 10:32 AM",
      status: "Preparing",
      total: 148,
      items: [
        {
          name: "Classic Burger",
          quantity: 1,
          emoji: "🍔",
        },
        {
          name: "Iced Coffee",
          quantity: 1,
          emoji: "☕",
        },
      ],
    },
    {
      id: "#ORD-1021",
      date: "Aug 29, 2026",
      status: "Completed",
      total: 179,
      items: [
        {
          name: "Fresh Sandwich",
          quantity: 1,
          emoji: "🥪",
        },
        {
          name: "Potato Chips",
          quantity: 2,
          emoji: "🍟",
        },
      ],
    },
    {
      id: "#ORD-1018",
      date: "Aug 27, 2026",
      status: "Ready",
      total: 94,
      items: [
        {
          name: "Soft Drink",
          quantity: 1,
          emoji: "🥤",
        },
        {
          name: "Chocolate Bar",
          quantity: 1,
          emoji: "🍫",
        },
      ],
    },
    {
      id: "#ORD-1015",
      date: "Aug 25, 2026",
      status: "Cancelled",
      total: 129,
      items: [
        {
          name: "Classic Burger",
          quantity: 1,
          emoji: "🍔",
        },
      ],
    },
  ];

  const filteredOrders =
    selectedFilter === "All"
      ? orders
      : orders.filter((order) => order.status === selectedFilter);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "Completed":
        return "#007A53";

      case "Ready":
        return "#007A53";

      case "Preparing":
        return "#FF6720";

      case "Cancelled":
        return "#DA291C";
    }
  };

  const getStatusBackground = (status: OrderStatus) => {
    switch (status) {
      case "Completed":
        return "#E8F5EF";

      case "Ready":
        return "#E8F5EF";

      case "Preparing":
        return "#FFF3E8";

      case "Cancelled":
        return "#FFF0F0";
    }
  };

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
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
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
          {filters.map((filter) => {
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
                    {
                      color: active ? "#FFFFFF" : colors.headline,
                    },
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
          {filteredOrders.map((order) => {
            const statusColor = getStatusColor(order.status);

            const statusBackground = getStatusBackground(order.status);

            return (
              <Pressable
                key={order.id}
                style={[
                  styles.orderCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Order Header */}
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={[styles.orderId, { color: colors.headline }]}>
                      {order.id}
                    </Text>

                    <Text style={[styles.orderDate, { color: colors.muted }]}>
                      {order.date}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusBackground,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: statusColor,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: statusColor,
                        },
                      ]}
                    >
                      {order.status}
                    </Text>
                  </View>
                </View>

                {/* Items */}
                <View
                  style={[styles.separator, { backgroundColor: colors.border }]}
                />

                <View style={styles.items}>
                  {order.items.map((item, index) => (
                    <View key={`${order.id}-${index}`} style={styles.item}>
                      <View
                        style={[
                          styles.itemImage,
                          {
                            backgroundColor: colors.background,
                          },
                        ]}
                      >
                        <Text style={styles.itemEmoji}>{item.emoji}</Text>
                      </View>

                      <View style={styles.itemDetails}>
                        <Text
                          style={[styles.itemName, { color: colors.headline }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>

                        <Text
                          style={[styles.itemQuantity, { color: colors.muted }]}
                        >
                          Quantity: {item.quantity}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Bottom */}
                <View
                  style={[styles.separator, { backgroundColor: colors.border }]}
                />

                <View style={styles.orderBottom}>
                  <View>
                    <Text style={[styles.totalLabel, { color: colors.muted }]}>
                      Total
                    </Text>

                    <Text style={[styles.total, { color: "#007A53" }]}>
                      ₱{order.total.toFixed(2)}
                    </Text>
                  </View>

                  {order.status === "Completed" ? (
                    <Pressable
                      style={[
                        styles.reorderButton,
                        {
                          borderColor: "#007A53",
                        },
                      ]}
                    >
                      <RotateCcw size={16} color="#007A53" />

                      <Text style={[styles.reorderText, { color: "#007A53" }]}>
                        Reorder
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.viewOrder}>
                      <Text
                        style={[styles.viewOrderText, { color: "#007A53" }]}
                      >
                        View order
                      </Text>

                      <ChevronRight size={17} color="#007A53" />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Empty State */}
        {filteredOrders.length === 0 && (
          <View style={styles.emptyContainer}>
            <View
              style={[styles.emptyIcon, { backgroundColor: colors.surface }]}
            >
              <PackageCheck size={42} color="#007A53" />
            </View>

            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              No orders found
            </Text>

            <Text style={[styles.emptyText, { color: colors.muted }]}>
              You don't have any {selectedFilter.toLowerCase()} orders yet.
            </Text>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 25,
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

  reorderButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  reorderText: {
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
});

export default Orders;
