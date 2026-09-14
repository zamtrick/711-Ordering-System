import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, ShieldCheck, Save, Check } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type AdminPermissions = {
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageRiders: boolean;
};

const PERMISSION_LABELS: { key: keyof AdminPermissions; label: string; hint: string }[] = [
  { key: "canManageProducts", label: "Manage Products", hint: "Branch admins can create, edit and delete catalogue products" },
  { key: "canManageCategories", label: "Manage Categories", hint: "Branch admins can create, edit and delete categories" },
  { key: "canManageRiders", label: "Manage Riders", hint: "Branch admins can add, edit and remove riders" },
];

// --------------------------------------------------
// FETCHERS
// --------------------------------------------------

const fetchDeliveryFee = () =>
  api.get("/settings/delivery-fee").then((res) => res.data?.data?.fee as number);

const fetchPermissions = () =>
  api
    .get<{ data: AdminPermissions }>("/settings/admin-permissions")
    .then((res) => res.data?.data);

// --------------------------------------------------
// TOGGLE SWITCH
// --------------------------------------------------

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-accent" : "bg-line"
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[24px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const { toasts, removeToast, success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // ── Delivery fee ────────────────────────────────
  const { data: fee, error: feeError } = useQuery({
    queryKey: ["settings", "delivery-fee"],
    queryFn: fetchDeliveryFee,
  });
  const [feeInput, setFeeInput] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [feeSaved, setFeeSaved] = useState(false);

  useEffect(() => {
    if (fee !== undefined) setFeeInput(String(fee));
  }, [fee]);

  // ── Admin permissions ───────────────────────────
  const { data: perms, error: permsError } = useQuery({
    queryKey: ["settings", "admin-permissions"],
    queryFn: fetchPermissions,
  });
  const [permDraft, setPermDraft] = useState<AdminPermissions | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permsSaved, setPermsSaved] = useState(false);

  useEffect(() => {
    if (perms) setPermDraft(perms);
  }, [perms]);

  useEffect(() => {
    if (feeError) toastError("Failed to load delivery fee.");
  }, [feeError, toastError]);

  useEffect(() => {
    if (permsError) toastError("Failed to load admin permissions.");
  }, [permsError, toastError]);

  // ── Save handlers ───────────────────────────────

  const saveFee = async () => {
    const value = Number(feeInput);
    if (!Number.isFinite(value) || value < 0) {
      toastError("Fee must be a number greater than or equal to 0.");
      return;
    }
    setSavingFee(true);
    try {
      await api.put("/settings/delivery-fee", { fee: value });
      success("Delivery fee updated.");
      queryClient.invalidateQueries({ queryKey: ["settings", "delivery-fee"] });
      setFeeSaved(true);
      setTimeout(() => setFeeSaved(false), 1500);
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update fee.");
    } finally {
      setSavingFee(false);
    }
  };

  const savePermissions = async () => {
    if (!permDraft) return;
    setSavingPerms(true);
    try {
      const res = await api.put("/settings/admin-permissions", permDraft);
      success("Admin permissions updated.");
      queryClient.setQueryData(["settings", "admin-permissions"], res.data?.data);
      setPermsSaved(true);
      setTimeout(() => setPermsSaved(false), 1500);
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update permissions.");
    } finally {
      setSavingPerms(false);
    }
  };

  const feeDirty = fee !== undefined && Number(feeInput) !== fee;
  const permsDirty = perms !== null && permDraft !== null && JSON.stringify(permDraft) !== JSON.stringify(perms);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Platform-wide configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ── Delivery fee ─────────────────────────── */}
        <div className="rounded-2xl border bg-surface border-line overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-line">
            <Truck size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-ink">Delivery Fee</h3>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-muted mb-4">
              Flat fee (₱) charged on every order. Customers see this at checkout before placing an order.
            </p>
            {fee === undefined ? (
              <div className="h-11 w-40 rounded-xl bg-sunken animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center h-11 rounded-xl border bg-surface border-line">
                  <span className="pl-3 text-sm font-bold text-muted">₱</span>
                  <input
                    type="number"
                    min={0}
                    value={feeInput}
                    onChange={(e) => setFeeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && feeDirty && saveFee()}
                    disabled={savingFee}
                    className="w-28 h-full px-2 outline-none bg-transparent text-sm font-semibold text-ink"
                  />
                </div>
                <button
                  onClick={saveFee}
                  disabled={savingFee || !feeDirty}
                  className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white transition-colors ${
                    feeDirty ? "bg-accent hover:bg-accent/90 cursor-pointer" : "bg-faint/40 cursor-not-allowed"
                  } disabled:opacity-60`}
                >
                  {feeSaved ? <Check size={15} /> : <Save size={15} />}
                  {savingFee ? "Saving…" : feeSaved ? "Saved" : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Admin permissions ────────────────────── */}
        <div className="rounded-2xl border bg-surface border-line overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-line">
            <ShieldCheck size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-ink">Branch Admin Permissions</h3>
          </div>
          <div className="px-6 py-5">
            {!isSuperAdmin && (
              <p className="text-xs font-semibold text-warning bg-warning-soft px-3 py-2 rounded-xl mb-4">
                Read-only — only the superadmin can change these toggles.
              </p>
            )}
            {!permDraft ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-9 rounded-xl bg-sunken animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {PERMISSION_LABELS.map(({ key, label, hint }) => (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-ink">{label}</p>
                        <p className="text-xs text-faint mt-0.5">{hint}</p>
                      </div>
                      <Toggle
                        checked={permDraft[key]}
                        disabled={!isSuperAdmin || savingPerms}
                        onChange={(v) => setPermDraft({ ...permDraft, [key]: v })}
                      />
                    </div>
                  ))}
                </div>

                {isSuperAdmin && (
                  <div className="flex justify-end mt-5">
                    <button
                      onClick={savePermissions}
                      disabled={savingPerms || !permsDirty}
                      className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white transition-colors ${
                        permsDirty ? "bg-accent hover:bg-accent/90 cursor-pointer" : "bg-faint/40 cursor-not-allowed"
                      } disabled:opacity-60`}
                    >
                      {permsSaved ? <Check size={15} /> : <Save size={15} />}
                      {savingPerms ? "Saving…" : permsSaved ? "Saved" : "Save"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
