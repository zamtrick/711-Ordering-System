import { useEffect, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
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
  Trash,
  Plus,
  Gift,
  Lock,
} from "lucide-react-native";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import { ProfileSkeleton } from "@/components/Skeleton";
import { type DeliveryCoords } from "@/components/DeliveryMapPicker";
import EditProfileModal, {
  type EditForm,
} from "@/components/modals/EditProfileModal";
import AddAddressModal from "@/components/modals/AddAddressModal";
import EditAddressModal from "@/components/modals/EditAddressModal";
import ChangePasswordModal, {
  type PwForm,
} from "@/components/modals/ChangePasswordModal";
import { router } from "expo-router";
import api from "@/api/axios";
import { getErrorMessage, isUnauthorized } from "@/utils/error";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type AddressItem = {
  _id: string;
  label: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
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

// --------------------------------------------------
// PROFILE SCREEN
// --------------------------------------------------

const Profile = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loyalty, setLoyalty] = useState<{ points: number; tier: string } | null>(null);

  // Edit profile modal
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstname: "",
    lastname: "",
    phone: "",
    address: "",
    age: "",
  });

  // Password change modal
  const [pwVisible, setPwVisible] = useState(false);
  const [pwForm, setPwForm] = useState<PwForm>({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!pwForm.current) { Alert.alert("Validation", "Current password is required."); return; }
    if (pwForm.next.length < 8) { Alert.alert("Validation", "New password must be at least 8 characters."); return; }
    if (pwForm.next !== pwForm.confirm) { Alert.alert("Validation", "Passwords do not match."); return; }
    try {
      setPwSaving(true);
      await api.patch("/auth/change-password", {
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
      });
      Alert.alert("Success", "Password changed successfully.");
      setPwVisible(false);
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to change password."));
    } finally {
      setPwSaving(false);
    }
  };
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newAddressCoords, setNewAddressCoords] = useState<DeliveryCoords | null>(null);

  // Add address modal
  const [addAddressVisible, setAddAddressVisible] = useState(false);

  // Edit address modal
  const [editAddressVisible, setEditAddressVisible] = useState(false);
  const [editAddressItemId, setEditAddressItemId] = useState<string | null>(null);
  const [editAddressCoords, setEditAddressCoords] = useState<DeliveryCoords | null>(null);

  // Map picker auto-fills the text field via reverse geocoding. Manual edits
  // keep the last known pin coords so the address still carries them.
  const handleMapAddress = useCallback(
    (address: string, coords: DeliveryCoords | null) => {
      setNewAddress(address);
      if (coords) setNewAddressCoords(coords);
    },
    [],
  );

  const handleEditMapAddress = useCallback(
    (address: string, coords: DeliveryCoords | null) => {
      setNewAddress(address);
      if (coords) setEditAddressCoords(coords);
    },
    [],
  );

// --------------------------------------------------
  // FETCH PROFILE
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const res = await api.get("/customer/profile/me");
        const profileData = res.data?.data;
        if (profileData && mounted) {
          setProfile(profileData);
        }
      } catch (err) {
        if (isUnauthorized(err)) {
          router.replace("/(auth)/login");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProfile();
    return () => { mounted = false; };
  }, []);

  // Loyalty balance — best-effort, shown as a card under the profile header.
  useEffect(() => {
    let mounted = true;
    api
      .get("/customer/loyalty")
      .then((res) => {
        const data = res.data?.data;
        if (mounted && data) {
          setLoyalty({ points: data.points ?? 0, tier: data.tier?.name ?? "Bronze" });
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
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
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error, "Failed to update profile."));
      if (isUnauthorized(error)) router.replace("/(auth)/login");
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
    setNewAddressCoords(null);
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
        lat: newAddressCoords?.latitude,
        lng: newAddressCoords?.longitude,
      });
      if (response.data?.data) setProfile(response.data.data);
      setAddAddressVisible(false);
      setNewAddressLabel("");
      setNewAddress("");
      setNewAddressCoords(null);
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error, "Failed to add address."));
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
    setEditAddressCoords(null);
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
          ...(editAddressCoords
            ? { lat: editAddressCoords.latitude, lng: editAddressCoords.longitude }
            : {}),
        },
      );
      if (response.data?.data) setProfile(response.data.data);
      setEditAddressVisible(false);
      setNewAddressLabel("");
      setNewAddress("");
      setEditAddressItemId(null);
      setEditAddressCoords(null);
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error, "Failed to update address."));
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
          } catch (error) {
            Alert.alert("Error", getErrorMessage(error, "Failed to remove address."));
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
      <ThemedView>
        <ProfileSkeleton />
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

        {/* REWARDS CARD */}
        <Pressable
          onPress={() => router.push("/(customer)/loyalty")}
          style={styles.rewardsCard}
        >
          <View style={styles.rewardsIcon}>
            <Gift size={22} color="#fff" />
          </View>
          <View style={styles.rewardsContent}>
            <Text style={styles.rewardsPoints}>
              {loyalty?.points ?? 0} points
            </Text>
            <Text style={styles.rewardsTier}>
              {loyalty?.tier ?? "Bronze"} member · Tap to view rewards
            </Text>
          </View>
          <ChevronRight size={20} color="#D7F0E6" />
        </Pressable>

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
            onPress={() => router.push("/(customer)/favorites")}
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
            icon={<Lock size={20} color="#4F46E5" />}
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => { setPwForm({ current: "", next: "", confirm: "" }); setPwVisible(true); }}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MenuItem
            icon={<MapPin size={20} color="#FF6720" />}
            title="Store Locator"
            subtitle="Find branches that deliver to you"
            onPress={() => router.push("/(customer)/store-locator")}
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

      <EditProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        form={editForm}
        setForm={setEditForm}
        saving={saving}
        onSave={handleSave}
        colors={colors}
      />
      <AddAddressModal
        visible={addAddressVisible}
        onClose={() => setAddAddressVisible(false)}
        label={newAddressLabel}
        setLabel={setNewAddressLabel}
        address={newAddress}
        onMapChange={handleMapAddress}
        saving={saving}
        onAdd={addAddress}
        colors={colors}
      />
      <EditAddressModal
        visible={editAddressVisible}
        onClose={() => setEditAddressVisible(false)}
        label={newAddressLabel}
        setLabel={setNewAddressLabel}
        address={newAddress}
        onMapChange={handleEditMapAddress}
        saving={saving}
        onUpdate={updateAddressItem}
        colors={colors}
      />
      <ChangePasswordModal
        visible={pwVisible}
        onClose={() => setPwVisible(false)}
        form={pwForm}
        setForm={setPwForm}
        saving={pwSaving}
        onChange={handleChangePassword}
        colors={colors}
      />
    </ThemedView>
  );
};

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
  colors: ThemeColors;
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
  colors: ThemeColors;
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

  rewardsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007A53",
    borderRadius: 18,
    padding: 16,
    marginBottom: 28,
  },

  rewardsIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  rewardsContent: { flex: 1, marginLeft: 13 },

  rewardsPoints: { color: "#fff", fontSize: 18, fontWeight: "800" },

  rewardsTier: { color: "#D7F0E6", fontSize: 12, marginTop: 3 },

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
});

export default Profile;
