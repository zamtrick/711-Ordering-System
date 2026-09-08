import { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";

import {
  User,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Package,
  Heart,
  Settings,
  HelpCircle,
  LogOut,
  Pencil,
  X,
  Check,
  Trash,
  Plus,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import { router } from "expo-router";
import api from "@/api/axios";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type AddressItem = {
  _id: string;
  label: string;
  address: string;
  isDefault: boolean;
};

type ProfileData = {
  user: {
    firstname: string;
    lastname: string;
    email: string;
  };
  phone: string;
  addresses: AddressItem[];
  age: string;
};

type EditForm = {
  firstname: string;
  lastname: string;
  phone: string;
  address: string;
  age: string;
};

// --------------------------------------------------
// PROFILE SCREEN
// --------------------------------------------------

const Profile = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit profile modal
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstname: "",
    lastname: "",
    phone: "",
    address: "",
    age: "",
  });

  // Add address modal
  const [addAddressVisible, setAddAddressVisible] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // Edit address modal
  const [editAddressVisible, setEditAddressVisible] = useState(false);
  const [editAddressItemId, setEditAddressItemId] = useState<string | null>(null);

  // --------------------------------------------------
  // FETCH PROFILE
  // --------------------------------------------------

  const fetchProfile = async () => {
    try {
      const response = await api.get("/customer/profile/me");
      if (response.data?.data) {
        setProfile(response.data.data);
      }
    } catch (error: any) {
      console.log("Get profile error:", error);
      if (error?.response?.status === 401) {
        router.replace("/(auth)/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // --------------------------------------------------
  // EDIT PROFILE
  // --------------------------------------------------

  const openEdit = () => {
    setEditForm({
      firstname: profile?.user?.firstname ?? "",
      lastname: profile?.user?.lastname ?? "",
      phone: profile?.phone ?? "",
      address:
        profile?.addresses?.find((a) => a.isDefault)?.address ??
        profile?.addresses?.[0]?.address ??
        "",
      age: profile?.age ?? "",
    });
    setEditVisible(true);
  };

  const handleSave = async () => {
    const { firstname, lastname, phone, address, age } = editForm;

    if (!firstname.trim() || !lastname.trim()) {
      Alert.alert("Validation", "First name and last name are required.");
      return;
    }

    try {
      setSaving(true);
      const response = await api.patch("/customer/profile/me", {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        phone: phone.trim(),
        address: address.trim(),
        age: age.trim(),
      });
      if (response.data?.data) setProfile(response.data.data);
      setEditVisible(false);
    } catch (error: any) {
      console.log("Update profile error:", error);
      const message =
        error?.response?.data?.message ?? "Failed to update profile.";
      Alert.alert("Error", message);
      if (error?.response?.status === 401) router.replace("/(auth)/login");
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // ADDRESS — ADD
  // --------------------------------------------------

  const openAddAddress = () => {
    setNewAddressLabel("");
    setNewAddress("");
    setAddAddressVisible(true);
  };

  const addAddress = async () => {
    if (!newAddress.trim()) {
      Alert.alert("Validation", "Address cannot be empty.");
      return;
    }
    try {
      setSaving(true);
      const response = await api.post("/customer/profile/me/addresses", {
        label: newAddressLabel.trim() || "Address",
        address: newAddress.trim(),
      });
      if (response.data?.data) setProfile(response.data.data);
      setAddAddressVisible(false);
      setNewAddressLabel("");
      setNewAddress("");
    } catch (error: any) {
      console.log("Add address error:", error);
      const message =
        error?.response?.data?.message ?? "Failed to add address.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // ADDRESS — EDIT
  // --------------------------------------------------

  const openEditAddress = (item: AddressItem) => {
    setNewAddressLabel(item.label);
    setNewAddress(item.address);
    setEditAddressItemId(item._id);
    setEditAddressVisible(true);
  };

  const updateAddressItem = async () => {
    if (!editAddressItemId) return;
    if (!newAddress.trim()) {
      Alert.alert("Validation", "Address cannot be empty.");
      return;
    }
    try {
      setSaving(true);
      const response = await api.patch(
        `/customer/profile/me/addresses/${editAddressItemId}`,
        {
          label: newAddressLabel.trim() || "Address",
          address: newAddress.trim(),
        },
      );
      if (response.data?.data) setProfile(response.data.data);
      setEditAddressVisible(false);
      setNewAddressLabel("");
      setNewAddress("");
      setEditAddressItemId(null);
    } catch (error: any) {
      console.log("Update address error:", error);
      const message =
        error?.response?.data?.message ?? "Failed to update address.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // ADDRESS — REMOVE
  // --------------------------------------------------

  const removeAddress = async (addressId: string) => {
    Alert.alert("Remove Address", "Are you sure you want to remove this address?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            const response = await api.delete(
              `/customer/profile/me/addresses/${addressId}`,
            );
            if (response.data?.data) setProfile(response.data.data);
          } catch (error: any) {
            console.log("Remove address error:", error);
            const message =
              error?.response?.data?.message ?? "Failed to remove address.";
            Alert.alert("Error", message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogOut = async () => {
    try {
      setLoggingOut(true);
      await api.post("/auth/logout");
      router.replace("/(auth)/login");
    } catch {
      router.replace("/(auth)/login");
    } finally {
      setLoggingOut(false);
    }
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading profile...
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
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.smallTitle, { color: colors.muted }]}>
              Account
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              My Profile
            </Text>
          </View>
          <Pressable
            onPress={openEdit}
            style={[
              styles.editButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pencil size={19} color="#007A53" />
          </Pressable>
        </View>

        {/* PROFILE CARD */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: "#E8F5EF" }]}>
            <User size={34} color="#007A53" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.headline }]}>
              {profile?.user?.firstname ?? "—"} {profile?.user?.lastname ?? ""}
            </Text>
            <Text style={[styles.email, { color: colors.muted }]}>
              {profile?.user?.email ?? "—"}
            </Text>
            <View style={styles.memberBadge}>
              <Text style={styles.memberText}>Customer</Text>
            </View>
          </View>
        </View>

        {/* PERSONAL INFORMATION */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Personal Information
        </Text>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <InfoRow
            icon={<User size={19} color="#007A53" />}
            label="First Name"
            value={profile?.user?.firstname ?? "—"}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow
            icon={<User size={19} color="#007A53" />}
            label="Last Name"
            value={profile?.user?.lastname ?? "—"}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow
            icon={<Mail size={19} color="#007A53" />}
            label="Email"
            value={profile?.user?.email ?? "—"}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow
            icon={<Phone size={19} color="#007A53" />}
            label="Phone"
            value={profile?.phone || "Not set"}
            colors={colors}
          />
        </View>

        {/* ADDRESSES */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Saved Addresses
        </Text>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {(profile?.addresses ?? []).length === 0 ? (
            <View style={styles.emptyAddressContainer}>
              <MapPin size={28} color={colors.muted} />
              <Text style={[styles.emptyAddressText, { color: colors.muted }]}>
                No addresses saved yet
              </Text>
            </View>
          ) : (
            (profile?.addresses ?? []).map((item, index) => (
              <View key={item._id}>
                <View style={styles.addressItem}>
                  <View
                    style={[
                      styles.addressIcon,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <MapPin
                      size={16}
                      color={item.isDefault ? "#007A53" : "#6B7280"}
                    />
                  </View>
                  <View style={styles.addressContent}>
                    <View style={styles.addressLabelRow}>
                      <Text
                        style={[styles.addressLabel, { color: colors.headline }]}
                      >
                        {item.label}
                      </Text>
                      {item.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[styles.addressValue, { color: colors.muted }]}
                      numberOfLines={2}
                    >
                      {item.address || "—"}
                    </Text>
                  </View>
                  <View style={styles.addressActions}>
                    <Pressable
                      style={styles.addressActionBtn}
                      onPress={() => openEditAddress(item)}
                    >
                      <Pencil size={15} color="#007A53" />
                    </Pressable>
                    <Pressable
                      style={styles.addressActionBtn}
                      onPress={() => removeAddress(item._id)}
                    >
                      <Trash size={15} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
                {index < (profile?.addresses ?? []).length - 1 && (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                )}
              </View>
            ))
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Pressable style={styles.addAddressButton} onPress={openAddAddress}>
            <Plus size={18} color="#007A53" />
            <Text style={styles.addAddressText}>Add New Address</Text>
          </Pressable>
        </View>

        {/* MY ACTIVITY */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          My Activity
        </Text>

        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MenuItem
            icon={<Package size={20} color="#007A53" />}
            title="My Orders"
            subtitle="View your order history"
            onPress={() => router.push("/(customer)/orders")}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MenuItem
            icon={<Heart size={20} color="#DA291C" />}
            title="Favorites"
            subtitle="Your saved products"
            colors={colors}
          />
        </View>

        {/* SETTINGS */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Settings
        </Text>

        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MenuItem
            icon={<Settings size={20} color="#007A53" />}
            title="Settings"
            subtitle="App preferences"
            onPress={() => router.push("/(customer)/settings")}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MenuItem
            icon={<HelpCircle size={20} color="#FF6720" />}
            title="Help & Support"
            subtitle="Get assistance"
            colors={colors}
          />
        </View>

        {/* LOGOUT */}
        <Pressable
          onPress={handleLogOut}
          disabled={loggingOut}
          style={[
            styles.logoutButton,
            {
              backgroundColor: colors.surface,
              borderColor: "#DA291C",
              opacity: loggingOut ? 0.6 : 1,
            },
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#DA291C" />
          ) : (
            <LogOut size={19} color="#DA291C" />
          )}
          <Text style={styles.logoutText}>
            {loggingOut ? "Logging out..." : "Logout"}
          </Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.muted }]}>
          Version 1.0.0
        </Text>
      </ScrollView>

      {/* ================================================
          EDIT PROFILE MODAL
      ================================================ */}
      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.headline }]}>
                Edit Profile
              </Text>
              <Pressable
                onPress={() => setEditVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.background }]}
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <EditField
                label="First Name"
                value={editForm.firstname}
                onChangeText={(v) => setEditForm((f) => ({ ...f, firstname: v }))}
                placeholder="Enter first name"
                colors={colors}
              />
              <EditField
                label="Last Name"
                value={editForm.lastname}
                onChangeText={(v) => setEditForm((f) => ({ ...f, lastname: v }))}
                placeholder="Enter last name"
                colors={colors}
              />
              <EditField
                label="Phone"
                value={editForm.phone}
                onChangeText={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                placeholder="e.g. +63 917 123 4567"
                keyboardType="phone-pad"
                colors={colors}
              />
              <EditField
                label="Age"
                value={editForm.age}
                onChangeText={(v) => setEditForm((f) => ({ ...f, age: v }))}
                placeholder="Enter your age"
                keyboardType="numeric"
                colors={colors}
              />
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[styles.saveButton, { opacity: saving ? 0.7 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Check size={18} color="#fff" />
                )}
                <Text style={styles.saveButtonText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================
          ADD ADDRESS MODAL
      ================================================ */}
      <Modal
        visible={addAddressVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddAddressVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.headline }]}>
                Add Address
              </Text>
              <Pressable
                onPress={() => setAddAddressVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.background }]}
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <EditField
              label="Label (e.g. Home, Work)"
              value={newAddressLabel}
              onChangeText={setNewAddressLabel}
              placeholder="e.g. Home"
              colors={colors}
            />
            <EditField
              label="Address"
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="Enter full address"
              colors={colors}
            />
            <Pressable
              onPress={addAddress}
              disabled={saving}
              style={[styles.saveButton, { opacity: saving ? 0.7 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Plus size={18} color="#fff" />
              )}
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Add Address"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================
          EDIT ADDRESS MODAL
      ================================================ */}
      <Modal
        visible={editAddressVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditAddressVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.headline }]}>
                Edit Address
              </Text>
              <Pressable
                onPress={() => setEditAddressVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.background }]}
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <EditField
              label="Label (e.g. Home, Work)"
              value={newAddressLabel}
              onChangeText={setNewAddressLabel}
              placeholder="e.g. Home"
              colors={colors}
            />
            <EditField
              label="Address"
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="Enter full address"
              colors={colors}
            />
            <Pressable
              onPress={updateAddressItem}
              disabled={saving}
              style={[styles.saveButton, { opacity: saving ? 0.7 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Check size={18} color="#fff" />
              )}
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
};

// --------------------------------------------------
// EDIT FIELD
// --------------------------------------------------

const EditField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  colors: any;
}) => (
  <View style={styles.editFieldWrapper}>
    <Text style={[styles.editFieldLabel, { color: colors.muted }]}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboardType}
      style={[
        styles.editFieldInput,
        {
          color: colors.headline,
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    />
  </View>
);

// --------------------------------------------------
// INFO ROW
// --------------------------------------------------

const InfoRow = ({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: any;
}) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIcon, { backgroundColor: colors.background }]}>
      {icon}
    </View>
    <View style={styles.infoContent}>
      <Text style={[styles.infoLabel, { color: colors.muted }]}>{label}</Text>
      <Text
        style={[styles.infoValue, { color: colors.headline }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  </View>
);

// --------------------------------------------------
// MENU ITEM
// --------------------------------------------------

const MenuItem = ({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress?: () => void;
  colors: any;
}) => (
  <Pressable style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIcon, { backgroundColor: colors.background }]}>
      {icon}
    </View>
    <View style={styles.menuContent}>
      <Text style={[styles.menuTitle, { color: colors.headline }]}>{title}</Text>
      <Text style={[styles.menuSubtitle, { color: colors.muted }]}>{subtitle}</Text>
    </View>
    <ChevronRight size={19} color={colors.muted} />
  </Pressable>
);

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1 },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: { marginTop: 12, fontSize: 14 },

  content: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  smallTitle: { fontSize: 14, marginBottom: 3 },

  title: { fontSize: 25, fontWeight: "800" },

  editButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  profileInfo: { flex: 1, marginLeft: 15 },

  name: { fontSize: 19, fontWeight: "800" },

  email: { fontSize: 12, marginTop: 4 },

  memberBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F5EF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 7,
  },

  memberText: { color: "#007A53", fontSize: 10, fontWeight: "700" },

  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 12 },

  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 25,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: { flex: 1, marginLeft: 11 },

  infoLabel: { fontSize: 11, marginBottom: 3 },

  infoValue: { fontSize: 13, fontWeight: "600" },

  divider: { height: 1 },

  // Address list
  emptyAddressContainer: {
    alignItems: "center",
    paddingVertical: 22,
    gap: 8,
  },

  emptyAddressText: { fontSize: 13 },

  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 10,
  },

  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  addressContent: { flex: 1 },

  addressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },

  addressLabel: { fontSize: 13, fontWeight: "700" },

  defaultBadge: {
    backgroundColor: "#E8F5EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  defaultBadgeText: { color: "#007A53", fontSize: 10, fontWeight: "700" },

  addressValue: { fontSize: 12, lineHeight: 17 },

  addressActions: {
    flexDirection: "row",
    gap: 4,
  },

  addressActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },

  addAddressText: {
    color: "#007A53",
    fontSize: 14,
    fontWeight: "700",
  },

  // Menu
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 25,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  menuContent: { flex: 1, marginLeft: 12 },

  menuTitle: { fontSize: 14, fontWeight: "700" },

  menuSubtitle: { fontSize: 11, marginTop: 3 },

  logoutButton: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },

  logoutText: { color: "#DA291C", fontSize: 14, fontWeight: "700" },

  version: { textAlign: "center", fontSize: 11, marginTop: 18 },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  modalTitle: { fontSize: 20, fontWeight: "800" },

  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  editFieldWrapper: { marginBottom: 16 },

  editFieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },

  editFieldInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },

  saveButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },

  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default Profile;
