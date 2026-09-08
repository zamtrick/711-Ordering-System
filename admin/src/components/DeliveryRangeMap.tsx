import { useEffect, useRef } from "react";
import * as L from "leaflet";

type Props = {
  /** Current marker position [lat, lng] */
  center: [number, number];
  /** Delivery range radius in km */
  radiusKm: number;
  /** Called when the marker is dragged or the map is clicked */
  onCenterChange: (lat: number, lng: number) => void;
};

// Styled pin so we never depend on Leaflet's default marker asset paths
// (which break under bundlers). Mirrors the app's green accent.
const pinIcon = L.divIcon({
  className: "",
  html: `
    <svg width="30" height="36" viewBox="0 0 30 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.72 0 0 6.72 0 15c0 11.25 15 21 15 21s15-9.75 15-21C30 6.72 23.28 0 15 0z" fill="#007A53"/>
      <circle cx="15" cy="14" r="6" fill="white"/>
    </svg>`,
  iconSize: [30, 36],
  iconAnchor: [15, 36],
});

export default function DeliveryRangeMap({
  center,
  radiusKm,
  onCenterChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  // Keep the latest callback without re-creating the map effects
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;

  // Create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: 13,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onCenterChangeRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map created once
  }, []);

  // Sync marker + delivery circle with props
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!markerRef.current) {
      const marker = L.marker(center, {
        icon: pinIcon,
        draggable: true,
        autoPan: true,
      }).addTo(map);

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        onCenterChangeRef.current(lat, lng);
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(center);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(center, {
        radius: radiusKm * 1000,
        color: "#007A53",
        weight: 2,
        fillColor: "#007A53",
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(center);
      circleRef.current.setRadius(radiusKm * 1000);
    }
  }, [center, radiusKm]);

  return <div ref={containerRef} className="w-full h-80 rounded-xl z-0" />;
}