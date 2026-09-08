import { useEffect, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import DeliveryRangeMap from "@/components/DeliveryRangeMap";

type Branch = {
  _id: string;
  name: string;
  branchCode: string;
  location: string;
  address?: { city?: string; barangay?: string; province?: string };
  deliveryRange?: number;
  coordinates?: { lat?: number | null; lng?: number | null };
};

// Fallback center when a branch has no coordinates yet (Metro Manila).
const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];
const MAX_RANGE = 20;

export default function Branches() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Delivery range editor state
  const [editing, setEditing] = useState<Branch | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [radiusKm, setRadiusKm] = useState(2);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/branches");
      setBranches(res.data?.branches ?? []);
    } catch {
      toastError("Failed to load branches.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const hasCoords = (b: Branch) =>
    typeof b.coordinates?.lat === "number" && typeof b.coordinates?.lng === "number";

  const openEditor = (b: Branch) => {
    setEditing(b);
    setCenter(
      hasCoords(b) ? [b.coordinates!.lat!, b.coordinates!.lng!] : DEFAULT_CENTER,
    );
    setRadiusKm(typeof b.deliveryRange === "number" ? b.deliveryRange : 2);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await api.patch(`/admin/branches/${editing._id}/delivery-range`, {
        deliveryRange: radiusKm,
        lat: center[0],
        lng: center[1],
      });
      const updated = res.data?.branch as Branch | undefined;
      if (updated) {
        setBranches((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
      }
      success("Delivery range saved.");
      setEditing(null);
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to save delivery range.",
      );
    } finally {
      setSaving(false);
    }
  };

  const rangeLabel = (b: Branch) =>
    typeof b.deliveryRange === "number" ? `${b.deliveryRange} km` : "—";

  const coordsLabel = (b: Branch) =>
    hasCoords(b)
      ? `${b.coordinates!.lat!.toFixed(4)}, ${b.coordinates!.lng!.toFixed(4)}`
      : "Not set";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Branches</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">
          Manage branch locations and delivery range coverage
        </p>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${isDark ? "bg-[#2A2A2A] border-[#2E2E2E]" : "bg-[#F8F5F2] border-[#E5E2DE]"}`}>
              {["Branch", "Location", "Delivery Range", "Map Coordinates", "Actions"].map((h) => (
                <th key={h} className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#777]">Loading...</td></tr>
            ) : branches.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-[#777]">No branches found.</td></tr>
            ) : (
              branches.map((b) => (
                <tr key={b._id} className={`border-b ${isDark ? "border-[#2E2E2E] hover:bg-[#2A2A2A]" : "border-[#F0F0F0] hover:bg-[#FAFAFA]"}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#232323] dark:text-white">{b.name}</p>
                    <p className="text-xs text-[#777] dark:text-[#A0A0A0]">{b.branchCode}</p>
                  </td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                    {b.address?.city || b.location || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isDark ? "bg-[#0A3D3D] text-[#4CAF50]" : "bg-[#E8F5EF] text-[#007A53]"}`}>
                      {rangeLabel(b)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#555] dark:text-[#A0A0A0]">{coordsLabel(b)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEditor(b)}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold bg-[#007A53] dark:bg-[#078080] text-white hover:opacity-90 cursor-pointer"
                    >
                      <MapPin size={13} />
                      Set Range
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delivery range editor */}
      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing ? `Delivery Range — ${editing.name}` : ""}
        width="max-w-3xl"
      >
        {editing && (
          <div>
            <div className="rounded-xl overflow-hidden border border-[#E5E2DE] dark:border-[#2E2E2E]">
              <DeliveryRangeMap
                center={center}
                radiusKm={radiusKm}
                onCenterChange={(lat, lng) => setCenter([lat, lng])}
              />
            </div>

            <p className={`text-xs mt-3 mb-1 font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>
              Delivery Radius
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={MAX_RANGE}
                step={0.5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="flex-1 accent-[#007A53] cursor-pointer"
                disabled={saving}
              />
              <div className={`flex items-center gap-1.5 px-3 h-10 rounded-xl border ${isDark ? "bg-[#121212] border-[#2E2E2E] text-white" : "bg-white border-[#E5E2DE] text-[#232323]"}`}>
                <Navigation size={14} className={isDark ? "text-[#4CAF50]" : "text-[#007A53]"} />
                <input
                  type="number"
                  min={0}
                  max={MAX_RANGE}
                  step={0.5}
                  value={radiusKm}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRadiusKm(Number.isFinite(v) ? Math.min(Math.max(v, 0), MAX_RANGE) : 0);
                  }}
                  className="w-14 bg-transparent outline-none text-sm font-bold"
                  disabled={saving}
                />
                <span className="text-xs text-[#777] dark:text-[#A0A0A0]">km</span>
              </div>
            </div>

            <p className={`text-xs mt-2 ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>
              Drag the pin or click the map to set the branch location. The shaded circle shows the delivery area.
            </p>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                Save Delivery Range
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}