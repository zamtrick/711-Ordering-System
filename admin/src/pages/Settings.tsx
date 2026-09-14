import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, ShieldCheck, Bike, Save, Check, ScanLine, Camera, MapPin } from "lucide-react";
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

const fetchRiderCapacity = () =>
  api.get("/settings/rider-capacity").then((res) => res.data?.data?.capacity as number);

export type DeliveryVerificationMode = "qr_and_photo" | "photo_only";

const fetchDeliveryVerification = () =>
  api
    .get<{ data: { mode: DeliveryVerificationMode } }>("/settings/delivery-verification")
    .then((res) => res.data?.data?.mode ?? "qr_and_photo");

const fetchDeliveryRange = () =>
  api.get("/settings/delivery-range").then((res) => res.data?.data?.rangeKm as number);

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

  // ── Rider capacity ────────────────────────────
  const { data: capacity, error: capacityError } = useQuery({
    queryKey: ["settings", "rider-capacity"],
    queryFn: fetchRiderCapacity,
  });
  const [capacityInput, setCapacityInput] = useState("");
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [capacitySaved, setCapacitySaved] = useState(false);

  useEffect(() => {
    if (capacity !== undefined) setCapacityInput(String(capacity));
  }, [capacity]);

  // ── Delivery verification flow ───────────────
  const { data: verificationMode, error: verificationError } = useQuery({
    queryKey: ["settings", "delivery-verification"],
    queryFn: fetchDeliveryVerification,
  });
  const [verModeDraft, setVerModeDraft] = useState<DeliveryVerificationMode | null>(null);
  const [savingVerification, setSavingVerification] = useState(false);
  const [verificationSaved, setVerificationSaved] = useState(false);

  useEffect(() => {
    if (verificationMode) setVerModeDraft(verificationMode);
  }, [verificationMode]);

  useEffect(() => {
    if (verificationError) toastError("Failed to load delivery verification mode.");
  }, [verificationError, toastError]);

  // ── Default delivery range ────────────────────
  const { data: rangeKm, error: rangeError } = useQuery({
    queryKey: ["settings", "delivery-range"],
    queryFn: fetchDeliveryRange,
  });
  const [rangeInput, setRangeInput] = useState("");
  const [savingRange, setSavingRange] = useState(false);
  const [rangeSaved, setRangeSaved] = useState(false);

  useEffect(() => {
    if (rangeKm !== undefined) setRangeInput(String(rangeKm));
  }, [rangeKm]);

  useEffect(() => {
    if (rangeError) toastError("Failed to load delivery range.");
  }, [rangeError, toastError]);

  useEffect(() => {
    if (perms) setPermDraft(perms);
  }, [perms]);

  useEffect(() => {
    if (feeError) toastError("Failed to load delivery fee.");
  }, [feeError, toastError]);

  useEffect(() => {
    if (permsError) toastError("Failed to load admin permissions.");
  }, [permsError, toastError]);

  useEffect(() => {
    if (capacityError) toastError("Failed to load rider capacity.");
  }, [capacityError, toastError]);

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

  const saveCapacity = async () => {
    const value = Number(capacityInput);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > 20) {
      toastError("Capacity must be a whole number between 1 and 20.");
      return;
    }
    setSavingCapacity(true);
    try {
      const res = await api.put("/settings/rider-capacity", { capacity: value });
      success("Rider capacity updated.");
      queryClient.setQueryData(["settings", "rider-capacity"], res.data?.data?.capacity);
      queryClient.invalidateQueries({ queryKey: ["riders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCapacitySaved(true);
      setTimeout(() => setCapacitySaved(false), 1500);
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update capacity.");
    } finally {
      setSavingCapacity(false);
    }
  };

  const saveVerification = async (mode: DeliveryVerificationMode) => {
    setSavingVerification(true);
    try {
      const res = await api.put("/settings/delivery-verification", { mode });
      success("Delivery verification mode updated.");
      queryClient.setQueryData(["settings", "delivery-verification"], res.data?.data?.mode);
      setVerModeDraft(res.data?.data?.mode ?? mode);
      setVerificationSaved(true);
      setTimeout(() => setVerificationSaved(false), 1500);
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update delivery verification mode.");
    } finally {
      setSavingVerification(false);
    }
  };

  const saveRange = async () => {
    const value = Number(rangeInput);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > 100) {
      toastError("Range must be a whole number between 1 and 100 km.");
      return;
    }
    setSavingRange(true);
    try {
      const res = await api.put("/settings/delivery-range", { rangeKm: value });
      success("Default delivery range updated.");
      queryClient.setQueryData(["settings", "delivery-range"], res.data?.data?.rangeKm);
      setRangeSaved(true);
      setTimeout(() => setRangeSaved(false), 1500);
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update delivery range.");
    } finally {
      setSavingRange(false);
    }
  };

  const feeDirty = fee !== undefined && Number(feeInput) !== fee;
  const permsDirty = perms !== null && permDraft !== null && JSON.stringify(permDraft) !== JSON.stringify(perms);
  const capacityDirty = capacity !== undefined && Number(capacityInput) !== capacity;
  const verificationDirty =
    verificationMode !== undefined && verModeDraft !== null && verModeDraft !== verificationMode;
  const rangeDirty = rangeKm !== undefined && Number(rangeInput) !== rangeKm;

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
            {!isSuperAdmin && (
              <p className="text-xs font-semibold text-warning bg-warning-soft px-3 py-2 rounded-xl mb-4">
                Read-only — only the superadmin can change the delivery fee.
              </p>
            )}
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
                    disabled={savingFee || !isSuperAdmin}
                    className="w-28 h-full px-2 outline-none bg-transparent text-sm font-semibold text-ink disabled:opacity-60"
                  />
                </div>
                {isSuperAdmin && (
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
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Rider capacity ───────────────────────── */}
        <div className="rounded-2xl border bg-surface border-line overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-line">
            <Bike size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-ink">Rider Capacity</h3>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-muted mb-4">
              Max concurrent active deliveries per rider. Riders at the cap can&apos;t self-accept more (admins can still force-assign past it in an emergency).
            </p>
            {!isSuperAdmin && (
              <p className="text-xs font-semibold text-warning bg-warning-soft px-3 py-2 rounded-xl mb-4">
                Read-only — only the superadmin can change the rider capacity.
              </p>
            )}
            {capacity === undefined ? (
              <div className="h-11 w-40 rounded-xl bg-sunken animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center h-11 rounded-xl border bg-surface border-line">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={capacityInput}
                    onChange={(e) => setCapacityInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && capacityDirty && saveCapacity()}
                    disabled={savingCapacity || !isSuperAdmin}
                    className="w-28 h-full px-3 outline-none bg-transparent text-sm font-semibold text-ink disabled:opacity-60"
                  />
                  <span className="pr-3 text-sm font-bold text-muted">orders</span>
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={saveCapacity}
                    disabled={savingCapacity || !capacityDirty}
                    className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white transition-colors ${
                      capacityDirty ? "bg-accent hover:bg-accent/90 cursor-pointer" : "bg-faint/40 cursor-not-allowed"
                    } disabled:opacity-60`}
                  >
                    {capacitySaved ? <Check size={15} /> : <Save size={15} />}
                    {savingCapacity ? "Saving…" : capacitySaved ? "Saved" : "Save"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Delivery verification flow ───────────── */}
        <div className="rounded-2xl border bg-surface border-line overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-line">
            <ScanLine size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-ink">Delivery Verification</h3>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-muted mb-4">
              How riders confirm a delivery. QR + photo requires the customer to show an in-app QR code that the rider scans before taking a proof photo. Photo only lets the rider complete the delivery with a camera photo alone.
            </p>
            {!isSuperAdmin && (
              <p className="text-xs font-semibold text-warning bg-warning-soft px-3 py-2 rounded-xl mb-4">
                Read-only — only the superadmin can change the delivery flow.
              </p>
            )}
            {verificationMode === undefined ? (
              <div className="h-20 rounded-xl bg-sunken animate-pulse" />
            ) : verModeDraft ? (
              <>
                <div className="space-y-3">
                  {([
                    {
                      value: "qr_and_photo" as DeliveryVerificationMode,
                      icon: ScanLine,
                      label: "QR code + photo",
                      hint: "Customer shows a QR, rider scans it, then takes a proof photo",
                    },
                    {
                      value: "photo_only" as DeliveryVerificationMode,
                      icon: Camera,
                      label: "Photo only",
                      hint: "Rider takes a proof photo — no QR code needed",
                    },
                  ]).map(({ value, icon: Icon, label, hint }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={!isSuperAdmin || savingVerification}
                      onClick={() => setVerModeDraft(value)}
                      className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed ${
                        verModeDraft === value
                          ? "border-accent bg-accent/5"
                          : "border-line bg-surface hover:bg-sunken/50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          verModeDraft === value ? "bg-accent text-white" : "bg-sunken text-muted"
                        }`}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-ink">{label}</span>
                        <span className="block text-xs text-faint mt-0.5">{hint}</span>
                      </span>
                      {verModeDraft === value && (
                        <span className="self-center">
                          <Check size={16} className="text-accent" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {isSuperAdmin && (
                  <div className="flex justify-end mt-5">
                    <button
                      onClick={() => verModeDraft && saveVerification(verModeDraft)}
                      disabled={savingVerification || !verificationDirty}
                      className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white transition-colors ${
                        verificationDirty ? "bg-accent hover:bg-accent/90 cursor-pointer" : "bg-faint/40 cursor-not-allowed"
                      } disabled:opacity-60`}
                    >
                      {verificationSaved ? <Check size={15} /> : <Save size={15} />}
                      {savingVerification ? "Saving…" : verificationSaved ? "Saved" : "Save"}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* ── Default delivery range ───────────────── */}
        <div className="rounded-2xl border bg-surface border-line overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-line">
            <MapPin size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-ink">Default Delivery Range</h3>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-muted mb-4">
              How far (km) each branch delivers from its map location. Branches with their own range set on the Branches page override this default.
            </p>
            {!isSuperAdmin && (
              <p className="text-xs font-semibold text-warning bg-warning-soft px-3 py-2 rounded-xl mb-4">
                Read-only — only the superadmin can change the delivery range.
              </p>
            )}
            {rangeKm === undefined ? (
              <div className="h-11 w-40 rounded-xl bg-sunken animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center h-11 rounded-xl border bg-surface border-line">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && rangeDirty && saveRange()}
                    disabled={savingRange || !isSuperAdmin}
                    className="w-28 h-full px-3 outline-none bg-transparent text-sm font-semibold text-ink disabled:opacity-60"
                  />
                  <span className="pr-3 text-sm font-bold text-muted">km</span>
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={saveRange}
                    disabled={savingRange || !rangeDirty}
                    className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white transition-colors ${
                      rangeDirty ? "bg-accent hover:bg-accent/90 cursor-pointer" : "bg-faint/40 cursor-not-allowed"
                    } disabled:opacity-60`}
                  >
                    {rangeSaved ? <Check size={15} /> : <Save size={15} />}
                    {savingRange ? "Saving…" : rangeSaved ? "Saved" : "Save"}
                  </button>
                )}
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
