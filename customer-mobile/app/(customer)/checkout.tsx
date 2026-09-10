import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
} from "react-native";
import {
  ChevronLeft,
  MapPin,
  Store,
  Clock,
  Phone,
  CreditCard,
  PackageSearch,
  Check,
  Plus,
  ChevronDown,
} from "lucide-react-native";
import { router } from "expo-router";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import { useCart } from "@/context/CartContext";
import api from "@/api/axios";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Branch = {
  _id: string;
  name: string;
  branchCode: string;
  location: string;
  address?: {
    street?: string;
    barangay?: string;
    city?: string;
    province?: string;
  };
  contactNumber?: string;
  openingTime?: string;
  closingTime?: string;
  paymentMethods?: string[];
};

type SavedAddress = {
  _id: string;
  label: string;
  address: string;
  isDefault: boolean;
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const formatBranchAddress = (b: Branch) => {
  if (!b.address) return b.location ?? "";
  const { street, barangay, city, province } = b.address;
  return [street, barangay, city, province].filter(Boolean).join(", ");
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

export default function Checkout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const { items, subtotal, clearCart, removeItem } = useCart();

  // ── data ─────────────────────────────────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── selections ───────────────────────────────────
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [useCustomAddress, setUseCustomAddress] = useState(false);

  // ── modals ───────────────────────────────────────
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);

  // ── submitting ───────────────────────────────────
  const [placing, setPlacing] = useState(false);

  // ── computed ─────────────────────────────────────
  const total = subtotal + (subtotal > 0 ? deliveryFee : 0);

  const resolvedDeliveryAddress = useCustomAddress
    ? customAddress.trim()
    : selectedAddress?.address ?? "";

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [branchRes, profileRes, feeRes] = await Promise.all([
          api.get("/customer/branches"),
          api.get("/customer/profile/me"),
          api.get("/settings/delivery-fee"),
        ]);

        const branchList: Branch[] = branchRes.data?.data ?? [];
        if (mounted) setBranches(branchList);
        if (branchList.length > 0 && mounted) setSelectedBranch(branchList[0]);

        const addresses: SavedAddress[] =
          profileRes.data?.data?.addresses ?? [];
        if (mounted) setSavedAddresses(addresses);
        const def = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
        if (mounted) setSelectedAddress(def);

        const fee = feeRes.data?.data?.fee;
        if (typeof fee === "number" && mounted) setDeliveryFee(fee);
      } catch (err: any) {
        console.log("Checkout load error:", err);
        if (err?.response?.status === 401) router.replace("/(auth)/login");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // --------------------------------------------------
  // PLACE ORDER
  // --------------------------------------------------

  const handlePlaceOrder = async () => {
    if (!selectedBranch) {
      Alert.alert("Select Branch", "Please select a branch to pick up / deliver from.");
      return;
    }
    if (!resolvedDeliveryAddress) {
      Alert.alert("Delivery Address", "Please enter or select a delivery address.");
      return;
    }
    if (items.length === 0) return;

    try {
      setPlacing(true);

      // 1. Create order
      console.log("[Checkout] POSTing /orders with branch:", selectedBranch._id);
      const orderRes = await api.post("/orders", {
        branch: selectedBranch._id,
        deliveryAddress: resolvedDeliveryAddress,
      });
      console.log("[Checkout] Create order response:", JSON.stringify(orderRes.data));

      const orderId: string = orderRes.data?.data?._id;
      if (!orderId) throw new Error("Failed to create order — no _id in response");

      // 2. Add items
      const failures: { name: string; message?: string }[] = [];

      for (const item of items) {
        try {
          console.log(`[Checkout] Adding item ${item.name} (qty ${item.quantity}) to order ${orderId}`);
          const itemRes = await api.post(`/orders/${orderId}/items`, {
            productId: item.id,
            quantity: item.quantity,
          });
          console.log(`[Checkout] Item response:`, JSON.stringify(itemRes.data));
        } catch (itemErr: any) {
          console.log(`[Checkout] ITEM FAILED (${item.name}):`, itemErr?.response?.data ?? itemErr?.message);
          failures.push({
            name: item.name,
            message: itemErr?.response?.data?.message,
          });
        }
      }

      if (failures.length === 0) {
        clearCart();
        router.replace("/(customer)/orders");
        // Small delay so the screen transitions first
        setTimeout(() => {
          Alert.alert("Order Placed!", "Your order has been placed successfully.");
        }, 400);
      } else {
        // Remove successfully added items from cart; keep failed ones
        const failedNames = new Set(failures.map((f) => f.name));
        items
          .filter((i) => !failedNames.has(i.name))
          .forEach((i) => removeItem(i.id));

        Alert.alert(
          "Partially Placed",
          failures[0]?.message ??
            "Some items couldn't be added (stock may have changed). They're still in your cart.",
        );
        router.replace("/(customer)/orders");
      }
    } catch (err: any) {
      console.log("Place order error:", err);
      const message =
        err?.response?.data?.message ?? "Could not place your order. Please try again.";
      Alert.alert("Order Failed", message);
      if (err?.response?.status === 401) router.replace("/(auth)/login");
    } finally {
      setPlacing(false);
    }
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Preparing checkout...
        </Text>
      </ThemedView>
    );
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HEADER ──────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ChevronLeft size={22} color={colors.headline} />
          </Pressable>
          <View>
            <Text style={[styles.smallTitle, { color: colors.muted }]}>
              Review your order
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              Checkout
            </Text>
          </View>
        </View>

        {/* ── BRANCH PICKER ───────────────────────── */}
        <SectionHeader icon={<Store size={15} color="#007A53" />} title="Branch" />

        <Pressable
          style={[
            styles.pickerCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => setBranchModalVisible(true)}
        >
          {selectedBranch ? (
            <View style={styles.pickerContent}>
              <View
                style={[styles.pickerIconWrap, { backgroundColor: "#E8F5EF" }]}
              >
                <Store size={20} color="#007A53" />
              </View>
              <View style={styles.pickerText}>
                <Text style={[styles.pickerTitle, { color: colors.headline }]}>
                  {selectedBranch.name}
                  {"  "}
                  <Text style={[styles.branchCode, { color: colors.muted }]}>
                    #{selectedBranch.branchCode}
                  </Text>
                </Text>
                <Text
                  style={[styles.pickerSub, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {formatBranchAddress(selectedBranch)}
                </Text>
                {(selectedBranch.openingTime || selectedBranch.closingTime) && (
                  <View style={styles.branchMeta}>
                    <Clock size={11} color={colors.muted} />
                    <Text style={[styles.branchMetaText, { color: colors.muted }]}>
                      {selectedBranch.openingTime ?? "—"} – {selectedBranch.closingTime ?? "—"}
                    </Text>
                  </View>
                )}
              </View>
              <ChevronDown size={18} color={colors.muted} />
            </View>
          ) : (
            <View style={styles.pickerContent}>
              <View
                style={[
                  styles.pickerIconWrap,
                  { backgroundColor: colors.background },
                ]}
              >
                <Store size={20} color={colors.muted} />
              </View>
              <Text style={[styles.pickerPlaceholder, { color: colors.muted }]}>
                Select a branch
              </Text>
              <ChevronDown size={18} color={colors.muted} />
            </View>
          )}
        </Pressable>

        {/* Branch payment methods */}
        {selectedBranch?.paymentMethods && selectedBranch.paymentMethods.length > 0 && (
          <View style={styles.paymentRow}>
            <CreditCard size={13} color={colors.muted} />
            <Text style={[styles.paymentLabel, { color: colors.muted }]}>
              Accepted:{" "}
              {selectedBranch.paymentMethods
                .map((m) => PAYMENT_LABELS[m] ?? m)
                .join(", ")}
            </Text>
          </View>
        )}

        {/* ── DELIVERY ADDRESS ────────────────────── */}
        <SectionHeader
          icon={<MapPin size={15} color="#007A53" />}
          title="Delivery Address"
        />

        {/* Saved address selector */}
        {savedAddresses.length > 0 && (
          <Pressable
            style={[
              styles.pickerCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              useCustomAddress && styles.pickerCardDimmed,
            ]}
            onPress={() => {
              setUseCustomAddress(false);
              setAddressModalVisible(true);
            }}
          >
            <View style={styles.pickerContent}>
              <View
                style={[
                  styles.pickerIconWrap,
                  {
                    backgroundColor: useCustomAddress
                      ? colors.background
                      : "#E8F5EF",
                  },
                ]}
              >
                <MapPin
                  size={20}
                  color={useCustomAddress ? colors.muted : "#007A53"}
                />
              </View>
              <View style={styles.pickerText}>
                {selectedAddress && !useCustomAddress ? (
                  <>
                    <Text
                      style={[styles.pickerTitle, { color: colors.headline }]}
                    >
                      {selectedAddress.label}
                      {selectedAddress.isDefault && (
                        <Text style={{ color: "#007A53", fontSize: 11 }}>
                          {"  "}Default
                        </Text>
                      )}
                    </Text>
                    <Text
                      style={[styles.pickerSub, { color: colors.muted }]}
                      numberOfLines={2}
                    >
                      {selectedAddress.address}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={[styles.pickerPlaceholder, { color: colors.muted }]}
                  >
                    Choose a saved address
                  </Text>
                )}
              </View>
              <ChevronDown size={18} color={colors.muted} />
            </View>
          </Pressable>
        )}

        {/* Toggle to custom address */}
        <Pressable
          style={styles.customToggle}
          onPress={() => setUseCustomAddress((v) => !v)}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: useCustomAddress ? "#007A53" : colors.border,
                backgroundColor: useCustomAddress ? "#007A53" : "transparent",
              },
            ]}
          >
            {useCustomAddress && <Check size={12} color="#fff" />}
          </View>
          <Text style={[styles.customToggleText, { color: colors.headline }]}>
            Use a different address
          </Text>
        </Pressable>

        {useCustomAddress && (
          <View
            style={[
              styles.customInputWrap,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MapPin size={18} color={colors.muted} />
            <TextInput
              value={customAddress}
              onChangeText={setCustomAddress}
              placeholder="Enter full delivery address…"
              placeholderTextColor={colors.muted}
              style={[styles.customInput, { color: colors.headline }]}
              multiline
            />
          </View>
        )}

        {/* ── ORDER SUMMARY ────────────────────────── */}
        <SectionHeader
          icon={<PackageSearch size={15} color="#007A53" />}
          title="Order Summary"
        />

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {items.map((item, idx) => (
            <View key={item.id}>
              <View style={styles.orderItem}>
                {/* Thumbnail */}
                <View
                  style={[
                    styles.thumbWrap,
                    { backgroundColor: colors.background },
                  ]}
                >
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <PackageSearch size={22} color={colors.muted} />
                  )}
                </View>

                <View style={styles.orderItemInfo}>
                  <Text
                    style={[styles.orderItemName, { color: colors.headline }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.orderItemCat, { color: colors.muted }]}>
                    {item.category}
                  </Text>
                </View>

                <View style={styles.orderItemRight}>
                  <Text style={[styles.orderItemQty, { color: colors.muted }]}>
                    x{item.quantity}
                  </Text>
                  <Text style={[styles.orderItemPrice, { color: "#007A53" }]}>
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              </View>

              {idx < items.length - 1 && (
                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />
              )}
            </View>
          ))}
        </View>

        {/* ── TOTALS ───────────────────────────────── */}
        <View
          style={[
            styles.totalsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.muted }]}>
              Subtotal
            </Text>
            <Text style={[styles.totalValue, { color: colors.headline }]}>
              ₱{subtotal.toFixed(2)}
            </Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.muted }]}>
              Delivery Fee
            </Text>
            <Text style={[styles.totalValue, { color: colors.headline }]}>
              ₱{deliveryFee.toFixed(2)}
            </Text>
          </View>

          <View
            style={[styles.totalDivider, { backgroundColor: colors.border }]}
          />

          <View style={styles.totalRow}>
            <Text style={[styles.grandLabel, { color: colors.headline }]}>
              Total
            </Text>
            <Text style={styles.grandValue}>₱{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* ── CONFIRM BUTTON ───────────────────────── */}
        <Pressable
          onPress={handlePlaceOrder}
          disabled={placing}
          style={[
            styles.confirmBtn,
            { opacity: placing ? 0.7 : 1 },
          ]}
        >
          {placing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Check size={20} color="#fff" />
          )}
          <Text style={styles.confirmText}>
            {placing ? "Placing Order…" : "Confirm Order"}
          </Text>
        </Pressable>
      </ScrollView>

      {/* ================================================
          BRANCH PICKER MODAL
      ================================================ */}
      <Modal
        visible={branchModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.surface }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.headline }]}>
                Select Branch
              </Text>
              <Pressable
                onPress={() => setBranchModalVisible(false)}
                style={[
                  styles.modalCloseBtn,
                  { backgroundColor: colors.background },
                ]}
              >
                <ChevronLeft size={20} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {branches.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  No active branches available.
                </Text>
              ) : (
                branches.map((branch) => {
                  const active = selectedBranch?._id === branch._id;
                  return (
                    <Pressable
                      key={branch._id}
                      onPress={() => {
                        setSelectedBranch(branch);
                        setBranchModalVisible(false);
                      }}
                      style={[
                        styles.branchOption,
                        {
                          backgroundColor: active
                            ? "#E8F5EF"
                            : colors.background,
                          borderColor: active ? "#007A53" : colors.border,
                        },
                      ]}
                    >
                      <View style={styles.branchOptionLeft}>
                        <Text
                          style={[
                            styles.branchOptionName,
                            { color: active ? "#007A53" : colors.headline },
                          ]}
                        >
                          {branch.name}
                        </Text>
                        <Text
                          style={[
                            styles.branchOptionAddr,
                            { color: colors.muted },
                          ]}
                          numberOfLines={1}
                        >
                          {formatBranchAddress(branch)}
                        </Text>
                        {(branch.openingTime || branch.closingTime) && (
                          <View style={styles.branchMeta}>
                            <Clock size={11} color={colors.muted} />
                            <Text
                              style={[
                                styles.branchMetaText,
                                { color: colors.muted },
                              ]}
                            >
                              {branch.openingTime ?? "—"} –{" "}
                              {branch.closingTime ?? "—"}
                            </Text>
                          </View>
                        )}
                        {branch.contactNumber && (
                          <View style={styles.branchMeta}>
                            <Phone size={11} color={colors.muted} />
                            <Text
                              style={[
                                styles.branchMetaText,
                                { color: colors.muted },
                              ]}
                            >
                              {branch.contactNumber}
                            </Text>
                          </View>
                        )}
                      </View>

                      {active && (
                        <View style={styles.activeCheck}>
                          <Check size={16} color="#007A53" />
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================
          ADDRESS PICKER MODAL
      ================================================ */}
      <Modal
        visible={addressModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.surface }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.headline }]}>
                Select Address
              </Text>
              <Pressable
                onPress={() => setAddressModalVisible(false)}
                style={[
                  styles.modalCloseBtn,
                  { backgroundColor: colors.background },
                ]}
              >
                <ChevronLeft size={20} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {savedAddresses.map((addr) => {
                const active = selectedAddress?._id === addr._id;
                return (
                  <Pressable
                    key={addr._id}
                    onPress={() => {
                      setSelectedAddress(addr);
                      setUseCustomAddress(false);
                      setAddressModalVisible(false);
                    }}
                    style={[
                      styles.branchOption,
                      {
                        backgroundColor: active
                          ? "#E8F5EF"
                          : colors.background,
                        borderColor: active ? "#007A53" : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.branchOptionLeft}>
                      <View style={styles.addrLabelRow}>
                        <Text
                          style={[
                            styles.branchOptionName,
                            { color: active ? "#007A53" : colors.headline },
                          ]}
                        >
                          {addr.label}
                        </Text>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.branchOptionAddr,
                          { color: colors.muted },
                        ]}
                        numberOfLines={2}
                      >
                        {addr.address}
                      </Text>
                    </View>

                    {active && (
                      <View style={styles.activeCheck}>
                        <Check size={16} color="#007A53" />
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {/* Quick shortcut to add a new address */}
              <Pressable
                style={[
                  styles.addAddrBtn,
                  { borderColor: colors.border },
                ]}
                onPress={() => {
                  setAddressModalVisible(false);
                  setUseCustomAddress(true);
                }}
              >
                <Plus size={16} color="#007A53" />
                <Text style={styles.addAddrText}>Use a different address</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// --------------------------------------------------
// SECTION HEADER
// --------------------------------------------------

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  const colorScheme = useColorScheme();
  const { colors } =
    colorScheme === "dark" ? DarkTheme : LightTheme;
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={[styles.sectionTitle, { color: colors.headline }]}>
        {title}
      </Text>
    </View>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1 },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: { marginTop: 12, fontSize: 14 },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
  },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  smallTitle: { fontSize: 13, marginBottom: 2 },
  title: { fontSize: 24, fontWeight: "800" },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
    marginTop: 6,
  },

  sectionTitle: { fontSize: 15, fontWeight: "800" },

  // Picker card
  pickerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },

  pickerCardDimmed: { opacity: 0.5 },

  pickerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  pickerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  pickerText: { flex: 1 },

  pickerTitle: { fontSize: 14, fontWeight: "700" },

  pickerSub: { fontSize: 12, marginTop: 2 },

  pickerPlaceholder: { fontSize: 14 },

  branchCode: { fontSize: 11 },

  branchMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },

  branchMetaText: { fontSize: 11 },

  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  paymentLabel: { fontSize: 11 },

  // Custom address
  customToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  customToggleText: { fontSize: 13, fontWeight: "600" },

  customInputWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },

  customInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },

  // Order summary
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 12,
  },

  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
  },

  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  thumb: { width: "100%", height: "100%" },

  orderItemInfo: { flex: 1 },

  orderItemName: { fontSize: 13, fontWeight: "700" },

  orderItemCat: { fontSize: 11, marginTop: 2 },

  orderItemRight: { alignItems: "flex-end" },

  orderItemQty: { fontSize: 11 },

  orderItemPrice: { fontSize: 14, fontWeight: "800", marginTop: 2 },

  divider: { height: 1 },

  // Totals
  totalsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  totalLabel: { fontSize: 13 },

  totalValue: { fontSize: 13, fontWeight: "600" },

  totalDivider: { height: 1, marginVertical: 8 },

  grandLabel: { fontSize: 16, fontWeight: "800" },

  grandValue: { fontSize: 20, fontWeight: "900", color: "#007A53" },

  // Confirm button
  confirmBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "85%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  modalTitle: { fontSize: 18, fontWeight: "800" },

  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: { textAlign: "center", padding: 20, fontSize: 13 },

  // Branch / address options inside modals
  branchOption: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },

  branchOptionLeft: { flex: 1 },

  branchOptionName: { fontSize: 14, fontWeight: "700" },

  branchOptionAddr: { fontSize: 12, marginTop: 3 },

  activeCheck: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#E8F5EF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  addrLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  defaultBadge: {
    backgroundColor: "#E8F5EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  defaultBadgeText: { color: "#007A53", fontSize: 10, fontWeight: "700" },

  addAddrBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 14,
    marginBottom: 6,
  },

  addAddrText: { color: "#007A53", fontSize: 13, fontWeight: "700" },
});
