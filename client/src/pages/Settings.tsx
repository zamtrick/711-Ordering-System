import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Truck, Save, RefreshCw, ShieldCheck } from "lucide-react";
import api from "@/api/axios";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/context/AuthContext";

// ─── Helpers ────────────────────────────────────────────────────────────────

function is401(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 401;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Settings() {
  const { toasts, removeToast, success, error: toastError } = useToast();
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const [fee, setFee] = useState<string>("");
  const [currentFee, setCurrentFee] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  const [perms, setPerms] = useState({
    canManageProducts: true,
    canManageCategories: true,
    canManageRiders: true,
  });
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsSaving, setPermsSaving] = useState(false);

  // ── Fetch current fee ─────────────────────────────────────────────────────

  const fetchFee = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/settings/delivery-fee");
      const value = res.data?.data?.fee;
      if (typeof value === "number") {
        setCurrentFee(value);
        setFee(String(value));
      } else {
        setError("Unexpected response from the server.");
      }
    } catch (err) {
      if (!is401(err)) {
        setError("Failed to load the delivery fee. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFee();
    if (isSuperadmin) fetchPerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  const fetchPerms = async () => {
    setPermsLoading(true);
    try {
      const res = await api.get("/settings/admin-permissions");
      const d = res.data?.data;
      if (d) setPerms({
        canManageProducts: d.canManageProducts ?? true,
        canManageCategories: d.canManageCategories ?? true,
        canManageRiders: d.canManageRiders ?? true,
      });
    } catch {
      // keep defaults
    } finally {
      setPermsLoading(false);
    }
  };

  const togglePerm = async (key: keyof typeof perms) => {
    const next = { ...perms, [key]: !perms[key] };
    setPerms(next);
    setPermsSaving(true);
    try {
      const res = await api.put("/settings/admin-permissions", next);
      const d = res.data?.data;
      if (d) setPerms({
        canManageProducts: d.canManageProducts ?? true,
        canManageCategories: d.canManageCategories ?? true,
        canManageRiders: d.canManageRiders ?? true,
      });
      success("Admin permissions updated!");
    } catch (err: unknown) {
      setPerms({ ...perms });
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update permissions.";
      toastError(message);
    } finally {
      setPermsSaving(false);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const parsed = Number(fee);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Please enter a valid amount (0 or higher).");
      return;
    }
    if (parsed > 10000) {
      setError("Fee cannot exceed ₱10,000.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await api.put("/settings/delivery-fee", {
        fee: Math.round(parsed),
      });
      const updated = res.data?.data?.fee;
      if (typeof updated === "number") {
        setCurrentFee(updated);
        setFee(String(updated));
      }
      success("Delivery fee updated!");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update the delivery fee.";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const headingText = "text-[#232323] dark:text-white";
  const mutedText = "text-[#777777] dark:text-[#A0A0A0]";
  const cardBg = "bg-white dark:bg-[#1E1E1E]";
  const borderColor = "border-[#E5E2DE] dark:border-[#2E2E2E]";

  return (
    <div className="max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-2xl font-bold ${headingText}`}>Settings</h1>
        <p className={`text-sm mt-1 ${mutedText}`}>
          Manage app-wide configuration. Changes apply to new orders only —
          existing orders keep the fee they were placed with.
        </p>
      </div>

      {isSuperadmin && (
        <div className={`${cardBg} border ${borderColor} rounded-2xl p-6 mb-6`}>
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${headingText}`}>Admin Permissions</h2>
              <p className={`text-xs mt-0.5 ${mutedText}`}>
                Toggle whether branch admins can manage each section. OFF = read-only (view only). You always keep full access.
              </p>
            </div>
          </div>

          {permsLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(
                [
                  { key: "canManageProducts", label: "Products", desc: "Create, edit, delete products and images" },
                  { key: "canManageCategories", label: "Categories", desc: "Create, edit, delete categories" },
                  { key: "canManageRiders", label: "Riders", desc: "Create, edit, delete riders" },
                ] as const
              ).map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  disabled={permsSaving}
                  onClick={() => togglePerm(key)}
                  className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border ${borderColor} transition-colors cursor-pointer ${perms[key] ? "" : "opacity-80"}`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-bold ${headingText}`}>{label}</p>
                    <p className={`text-xs ${mutedText}`}>{desc} — {perms[key] ? "Admin can manage" : "Read-only for admin"}</p>
                  </div>
                  <span
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${perms[key] ? "bg-[#007A53]" : "bg-[#D1D5DB] dark:bg-[#3A3A3A]"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${perms[key] ? "left-[22px]" : "left-0.5"}`}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delivery Fee Card */}
      <div className={`${cardBg} border ${borderColor} rounded-2xl p-6`}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#007A53] flex items-center justify-center shrink-0">
            <Truck size={20} className="text-white" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${headingText}`}>
              Delivery Fee
            </h2>
            <p className={`text-xs mt-0.5 ${mutedText}`}>
              Charged once per order and shown to customers at checkout.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-[#007A53] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label
                  htmlFor="fee"
                  className={`block text-sm font-semibold mb-2 ${headingText}`}
                >
                  Amount (₱) <span className="text-[#DA291C]">*</span>
                </label>
                <Input
                  id="fee"
                  type="number"
                  min="0"
                  max="10000"
                  step="1"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="e.g. 20"
                  required
                />
              </div>

              <Button type="submit" disabled={saving || fee === String(currentFee)}>
                <Save size={16} />
                {saving ? "Saving..." : "Save"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setFee(String(currentFee ?? ""));
                  setError("");
                }}
              >
                <RefreshCw size={16} />
                Reset
              </Button>
            </div>

            {error && (
              <p className="text-sm text-[#DA291C] mt-3">{error}</p>
            )}

            {currentFee !== null && !error && (
              <p className={`text-xs mt-3 ${mutedText}`}>
                Current fee: <span className="font-bold">₱{currentFee.toFixed(2)}</span>
                {" — "}new orders will charge this amount.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
