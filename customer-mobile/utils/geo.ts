// --------------------------------------------------
// GEO HELPERS
// --------------------------------------------------
// Shared distance math for delivery-range features (checkout range check,
// store locator circles, nearest-branch sorting). Mirrors the server-side
// haversine in settings.controller.js so client warnings agree with the
// server's final verdict.
// --------------------------------------------------

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type BranchLocation = {
  _id: string;
  name: string;
  branchCode: string;
  location?: string;
  address?: {
    street?: string;
    barangay?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  } | null;
  contactNumber?: string;
  openingTime?: string;
  closingTime?: string;
  deliveryRange?: number;
  coordinates?: { lat?: number | null; lng?: number | null };
};

// Platform-wide default when the settings endpoint is unreachable —
// keep in sync with the superadmin setting (DEFAULT_DELIVERY_RANGE_KM = 2).
export const DEFAULT_RANGE_KM = 2;

/**
 * Great-circle distance between two WGS84 points in kilometers.
 * Same math as the server's haversineKm in settings.controller.js.
 */
export const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/**
 * Distance in km from a point to a branch, or null when either side has
 * no usable coordinates.
 */
export const distanceToBranchKm = (
  point: LatLng,
  branch: Pick<BranchLocation, "coordinates">,
): number | null => {
  const lat = branch.coordinates?.lat;
  const lng = branch.coordinates?.lng;
  if (lat == null || lng == null) return null;
  return haversineKm(point.latitude, point.longitude, lat, lng);
};

/**
 * Effective delivery range for a branch: branch override when set (> 0),
 * otherwise the platform default.
 */
export const branchRangeKm = (
  branch: Pick<BranchLocation, "deliveryRange"> | null | undefined,
  defaultRangeKm: number = DEFAULT_RANGE_KM,
): number =>
  branch && typeof branch.deliveryRange === "number" && branch.deliveryRange > 0
    ? branch.deliveryRange
    : defaultRangeKm;

/**
 * Human-friendly distance label — metres under 1 km, km with one decimal
 * above that.
 */
export const formatDistanceKm = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
