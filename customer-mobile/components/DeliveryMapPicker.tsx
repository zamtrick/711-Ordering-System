import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, {
  Marker,
  UrlTile,
  type LatLng,
  type MapPressEvent,
  type Region,
} from "react-native-maps";
import * as Location from "expo-location";
import { LocateFixed, MapPin } from "lucide-react-native";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type DeliveryCoords = {
  latitude: number;
  longitude: number;
};

type ThemeColors = {
  surface: string;
  border: string;
  background: string;
  headline: string;
  muted: string;
};

type DeliveryMapPickerProps = {
  value: string;
  onChange: (address: string, coords: DeliveryCoords | null) => void;
  colors: ThemeColors;
};

// Metro Manila fallback — same defaults the backend uses for branches.
const DEFAULT_COORDS: DeliveryCoords = {
  latitude: 14.5995,
  longitude: 120.9842,
};

const REGION_DELTA = 0.008;

// Leaflet-style tiles (OpenStreetMap). No Google API key required — the
// map renders in Expo Go, dev builds and production builds alike.
const OSM_TILE_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const formatGeocodedAddress = (
  place: Location.LocationGeocodedAddress,
  fallback: DeliveryCoords
) => {
  const parts = [
    place.name,
    place.street,
    place.district,
    place.city,
    place.subregion,
    place.region,
    place.postalCode,
  ].filter((p, i, arr) => p && arr.indexOf(p) === i);
  if (parts.length > 0) return parts.join(", ");
  return `${fallback.latitude.toFixed(5)}, ${fallback.longitude.toFixed(5)}`;
};

// --------------------------------------------------
// COMPONENT
// --------------------------------------------------

// Interactive Leaflet-style map picker for the delivery address.
// Tap the map (or drag the pin) and the address field auto-fills via
// reverse geocoding. The field stays editable so the user can add
// landmarks / unit numbers afterwards.
const DeliveryMapPicker = ({
  value,
  onChange,
  colors,
}: DeliveryMapPickerProps) => {
  const [marker, setMarker] = useState<DeliveryCoords>(DEFAULT_COORDS);
  const [region, setRegion] = useState<Region>({
    ...DEFAULT_COORDS,
    latitudeDelta: REGION_DELTA,
    longitudeDelta: REGION_DELTA,
  });
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mapRef = useRef<MapView>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reverseGeocode = useCallback(
    async (coords: DeliveryCoords) => {
      setGeocoding(true);
      try {
        const results = await Location.reverseGeocodeAsync(coords);
        if (!mountedRef.current) return;
        if (results.length > 0) {
          onChange(formatGeocodedAddress(results[0], coords), coords);
        } else {
          onChange(
            `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
            coords
          );
        }
      } catch {
        if (!mountedRef.current) return;
        onChange(
          `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          coords
        );
      } finally {
        if (mountedRef.current) setGeocoding(false);
      }
    },
    [onChange]
  );

  const centerOn = useCallback((coords: DeliveryCoords) => {
    setMarker(coords);
    const next = {
      ...coords,
      latitudeDelta: REGION_DELTA,
      longitudeDelta: REGION_DELTA,
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 500);
  }, []);

  const locateMe = useCallback(
    async (autoFill = true) => {
      setLocating(true);
      setPermissionDenied(false);
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (mountedRef.current) setPermissionDenied(true);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mountedRef.current) return;
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        centerOn(coords);
        if (autoFill) await reverseGeocode(coords);
        else onChange(value, coords);
      } catch {
        // GPS off / timeout — user can still tap the map or type manually.
      } finally {
        if (mountedRef.current) setLocating(false);
      }
    },
    [centerOn, onChange, reverseGeocode, value]
  );

  // Try GPS once on mount so the field auto-fills without any taps.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    void locateMe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const handleMapPress = (e: MapPressEvent) => {
    const coords = e.nativeEvent.coordinate as DeliveryCoords;
    setMarker(coords);
    void reverseGeocode(coords);
  };

  // react-native-maps web needs a Google Maps JS key — fall back to a
  // plain text field there so web never renders a blank map.
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <MapPin size={18} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t, null)}
          placeholder="Enter full delivery address…"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.headline }]}
          multiline
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.mapFrame,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          mapType="none"
        >
          <UrlTile
            urlTemplate={OSM_TILE_TEMPLATE}
            maximumZ={19}
            flipY={false}
          />
          <Marker
            coordinate={marker as LatLng}
            draggable
            onDragEnd={(e) => {
              const coords = e.nativeEvent.coordinate as DeliveryCoords;
              setMarker(coords);
              void reverseGeocode(coords);
            }}
          >
            <View style={styles.pin}>
              <MapPin size={30} color="#DA291C" fill="#DA291C" />
            </View>
          </Marker>
        </MapView>

        {/* Re-center button */}
        <Pressable
          onPress={() => void locateMe(true)}
          disabled={locating}
          style={[
            styles.locateBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#007A53" />
          ) : (
            <LocateFixed size={18} color="#007A53" />
          )}
        </Pressable>

        {/* Geocoding status chip */}
        {geocoding && (
          <View style={styles.geocodeChip}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.geocodeText}>Finding address…</Text>
          </View>
        )}
      </View>

      <Text style={[styles.hint, { color: colors.muted }]}>
        Tap the map or drag the pin — the address fills in automatically.
      </Text>

      {permissionDenied && (
        <Text style={[styles.hint, { color: "#DA291C" }]}>
          Location permission denied — you can still tap the map or type the
          address manually.
        </Text>
      )}

      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <MapPin size={18} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t, null)}
          placeholder="Delivery address auto-fills from the pin…"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.headline }]}
          multiline
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },

  mapFrame: {
    height: 230,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  pin: {
    alignItems: "center",
    justifyContent: "center",
  },

  locateBtn: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  geocodeChip: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  geocodeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  hint: {
    fontSize: 11,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },

  input: {
    flex: 1,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },
});

export default DeliveryMapPicker;
