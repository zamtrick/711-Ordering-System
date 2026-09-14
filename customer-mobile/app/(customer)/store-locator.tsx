import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker, Circle, type Region } from "react-native-maps";
import * as Location from "expo-location";
import {
  ChevronLeft,
  MapPin,
  Store,
  Phone,
  Clock,
  LocateFixed,
  Check,
  Navigation,
} from "lucide-react-native";
import { router } from "expo-router";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import {
  distanceToBranchKm,
  branchRangeKm,
  formatDistanceKm,
  type BranchLocation,
} from "@/utils/geo";

// --------------------------------------------------
// Metro Manila fallback — same default the map picker uses.
// --------------------------------------------------
const DEFAULT_COORDS = {
  latitude: 14.5995,
  longitude: 120.9842,
};

const REGION_DELTA = 0.08;

// --------------------------------------------------
// Branch card shown under the map — sorted nearest-first.
// --------------------------------------------------
const BranchCard = ({
  branch,
  distanceKm,
  rangeKm,
  colors,
  onPress,
}: {
  branch: BranchLocation;
  distanceKm: number | null;
  rangeKm: number;
  colors: {
    surface: string;
    border: string;
    headline: string;
    muted: string;
    background: string;
  };
  onPress: () => void;
}) => {
  const inRange = distanceKm !== null && distanceKm <= rangeKm;
  const noCoords = distanceKm === null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.branchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.branchIcon, { backgroundColor: colors.background }]}>
        <Store size={20} color="#007A53" />
      </View>

      <View style={styles.branchInfo}>
        <View style={styles.branchNameRow}>
          <Text style={[styles.branchName, { color: colors.headline }]} numberOfLines={1}>
            {branch.name}
          </Text>
          {!noCoords && (
            <View
              style={[
                styles.rangeBadge,
                inRange ? styles.rangeBadgeIn : styles.rangeBadgeOut,
              ]}
            >
              {inRange && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
              <Text style={styles.rangeBadgeText}>
                {noCoords ? "—" : inRange ? "Delivers" : "Out of range"}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.branchSub, { color: colors.muted }]} numberOfLines={1}>
          {formatBranchLocation(branch)}
        </Text>

        <View style={styles.branchMetaRow}>
          {distanceKm !== null && (
            <View style={styles.metaItem}>
              <Navigation size={12} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>
                {formatDistanceKm(distanceKm)} away
              </Text>
            </View>
          )}
          {branch.openingTime && branch.closingTime && (
            <View style={styles.metaItem}>
              <Clock size={12} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>
                {branch.openingTime}–{branch.closingTime}
              </Text>
            </View>
          )}
          {branch.contactNumber && (
            <View style={styles.metaItem}>
              <Phone size={12} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>
                {branch.contactNumber}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const formatBranchLocation = (b: BranchLocation) => {
  if (b.address) {
    const { street, barangay, city, province } = b.address;
    const joined = [street, barangay, city, province].filter(Boolean).join(", ");
    if (joined) return joined;
  }
  return b.location ?? "";
};

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const StoreLocator = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  // ── fetch branches (public endpoint already returns coordinates + range) ──
  useEffect(() => {
    let mounted = true;
    api
      .get("/customer/branches")
      .then((res) => {
        if (!mounted) return;
        setBranches(res.data?.data ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // ── one-shot GPS fix on mount ─────────────────────
  const locateMe = useCallback(async (recenter = false) => {
    setLocating(true);
    setPermissionDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserCoords(coords);
      if (recenter) {
        mapRef.current?.animateToRegion(
          { ...coords, latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA },
          600,
        );
      }
    } catch {
      // GPS off / timeout — the list still works without a distance sort
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    // initial GPS fix fires asynchronously (permission prompt); sync part only flips `locating`
    // eslint-disable-next-line react-hooks/set-state-in-effect
    locateMe();
  }, [locateMe]);

  // ── derive distances + sort nearest-first (geo-less branches last) ──
  const sortedBranches = (() => {
    const withMeta = branches.map((b) => ({
      branch: b,
      distanceKm: userCoords ? distanceToBranchKm(userCoords, b) : null,
      rangeKm: branchRangeKm(b),
    }));
    withMeta.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
    return withMeta;
  })();

  const focusBranch = (branch: BranchLocation) => {
    setSelectedBranchId(branch._id);
    const lat = branch.coordinates?.lat;
    const lng = branch.coordinates?.lng;
    if (lat != null && lng != null) {
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        500,
      );
    }
  };

  const initialRegion: Region = userCoords
    ? { ...userCoords, latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA }
    : {
        ...DEFAULT_COORDS,
        latitudeDelta: REGION_DELTA * 4,
        longitudeDelta: REGION_DELTA * 4,
      };

  // ── loading ──────────────────────────────────────
  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Loading stores…</Text>
      </ThemedView>
    );
  }

  // ── render ───────────────────────────────────────
  return (
    <ThemedView>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ChevronLeft size={22} color={colors.headline} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.smallTitle, { color: colors.muted }]}>Find a store near you</Text>
          <Text style={[styles.title, { color: colors.headline }]}>Store Locator</Text>
        </View>
        <Pressable
          onPress={() => locateMe(true)}
          disabled={locating}
          style={[styles.locateBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#007A53" />
          ) : (
            <LocateFixed size={20} color="#007A53" />
          )}
        </Pressable>
      </View>

      {/* Map with delivery-range circles */}
      <View
        style={[
          styles.mapFrame,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation>
          {branches.map((b) => {
            const lat = b.coordinates?.lat;
            const lng = b.coordinates?.lng;
            if (lat == null || lng == null) return null;
            const selected = selectedBranchId === b._id;
            return (
              <View key={b._id}>
                {/* Delivery range circle */}
                <Circle
                  center={{ latitude: lat, longitude: lng }}
                  radius={branchRangeKm(b) * 1000}
                  strokeWidth={1.5}
                  strokeColor="rgba(0,122,83,0.45)"
                  fillColor="rgba(0,122,83,0.10)"
                />
                <Marker
                  coordinate={{ latitude: lat, longitude: lng }}
                  onPress={() => setSelectedBranchId(b._id)}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={[styles.markerWrap, selected && styles.markerSelected]}>
                    <Store size={14} color="#FFFFFF" />
                  </View>
                </Marker>
              </View>
            );
          })}
        </MapView>

        {permissionDenied && (
          <View style={styles.permissionChip}>
            <Text style={styles.permissionText}>
              Location off — distances unavailable. Enable to see the nearest branch.
            </Text>
          </View>
        )}
      </View>

      {/* Branch list — nearest first when the user's location is known */}
      <Text style={[styles.listTitle, { color: colors.headline }]}>
        {userCoords ? "Nearest branches" : "All branches"}
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {sortedBranches.map(({ branch, distanceKm, rangeKm }) => (
          <BranchCard
            key={branch._id}
            branch={branch}
            distanceKm={distanceKm}
            rangeKm={rangeKm}
            colors={colors}
            onPress={() => focusBranch(branch)}
          />
        ))}

        {sortedBranches.length === 0 && (
          <View style={styles.emptyWrap}>
            <MapPin size={30} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No active branches right now — check back soon.
            </Text>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallTitle: { fontSize: 13 },
  title: { fontSize: 22, fontWeight: "800" },
  locateBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  mapFrame: {
    height: 260,
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  map: { width: "100%", height: "100%" },

  markerWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#007A53",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  markerSelected: {
    backgroundColor: "#FF6720",
    transform: [{ scale: 1.15 }],
  },

  permissionChip: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: "90%",
  },
  permissionText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },

  listTitle: {
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 35, gap: 10 },

  branchCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
  },

  branchIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  branchInfo: { flex: 1 },
  branchNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  branchName: { fontSize: 14, fontWeight: "800", flexShrink: 1 },

  rangeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  rangeBadgeIn: { backgroundColor: "#007A53" },
  rangeBadgeOut: { backgroundColor: "#DA291C" },
  rangeBadgeText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "800" },

  branchSub: { fontSize: 12, marginTop: 3 },

  branchMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 7,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11 },

  emptyWrap: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyText: { fontSize: 13, textAlign: "center", maxWidth: 240 },
});

export default StoreLocator;
