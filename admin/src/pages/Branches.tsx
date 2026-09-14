import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  MapPin,
  Navigation,
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Download,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DeliveryRangeMap from "@/components/DeliveryRangeMap";
import Pagination from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type BranchStatus = "active" | "inactive" | "maintenance";

type Branch = {
  _id: string;
  name: string;
  branchCode: string;
  location: string;
  address?: {
    street?: string;
    barangay?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  contactNumber?: string;
  email?: string;
  status?: BranchStatus | string;
  openingTime?: string;
  closingTime?: string;
  paymentMethods?: string[];
  deliveryRange?: number;
  coordinates?: { lat?: number | null; lng?: number | null };
  createdAt?: string;
};

type BranchFormData = {
  name: string;
  branchCode: string;
  location: string;
  city: string;
  street: string;
  barangay: string;
  province: string;
  postalCode: string;
  contactNumber: string;
  email: string;
  status: BranchStatus;
  openingTime: string;
  closingTime: string;
  paymentMethods: string[];
};

type BranchesResponse = { branches: Branch[]; pagination?: PaginationMeta };

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

// Fallback center when a branch has no coordinates yet (Metro Manila).
const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];
const MAX_RANGE = 20;

const emptyForm = (): BranchFormData => ({
  name: "",
  branchCode: "",
  location: "",
  city: "",
  street: "",
  barangay: "",
  province: "",
  postalCode: "",
  contactNumber: "",
  email: "",
  status: "active",
  openingTime: "",
  closingTime: "",
  paymentMethods: [],
});

const statusLabel = (status: string) =>
  status === "active" ? "Active" : status === "maintenance" ? "Maintenance" : "Inactive";

const statusVariant = (status: string): "green" | "orange" | "gray" =>
  status === "active" ? "green" : status === "maintenance" ? "orange" : "gray";

const paymentLabel = (value: string) =>
  PAYMENT_OPTIONS.find((o) => o.value === value)?.label ?? value;

function validateForm(form: BranchFormData): Partial<Record<keyof BranchFormData, string>> {
  const errs: Partial<Record<keyof BranchFormData, string>> = {};
  if (!form.name.trim()) errs.name = "Branch name is required.";
  if (!form.branchCode.trim()) errs.branchCode = "Branch code is required.";
  if (!form.location.trim()) errs.location = "Location is required.";
  if (!form.city.trim()) errs.city = "City is required.";
  if (form.paymentMethods.length === 0) {
    errs.paymentMethods = "Select at least one payment method.";
  }
  return errs;
}

function exportToCSV(branches: Branch[]) {
  const headers = [
    "Name",
    "Code",
    "Location",
    "City",
    "Street",
    "Barangay",
    "Province",
    "Postal Code",
    "Contact",
    "Email",
    "Status",
    "Opening",
    "Closing",
    "Payment Methods",
    "Created",
  ];
  const rows = branches.map((b) => [
    b.name,
    b.branchCode,
    b.location,
    b.address?.city ?? "",
    b.address?.street ?? "",
    b.address?.barangay ?? "",
    b.address?.province ?? "",
    b.address?.postalCode ?? "",
    b.contactNumber ?? "",
    b.email ?? "",
    statusLabel(String(b.status ?? "active")),
    b.openingTime ?? "",
    b.closingTime ?? "",
    b.paymentMethods?.join(", ") ?? "",
    b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-PH") : "",
  ]);

  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `branches_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SkeletonRow() {
  const { isDark } = useTheme();
  return (
    <tr className={`animate-pulse border-b ${isDark ? "border-line" : "border-line"}`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className={`h-4 rounded ${isDark ? "bg-sunken" : "bg-sunken"}`} /></td>
      ))}
    </tr>
  );
}

// ─── Create / Edit form (shared) ──────────────────────────────────────────────

function BranchForm({
  mode,
  form,
  errors,
  submitting,
  onChange,
  onPaymentToggle,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: BranchFormData;
  errors: Partial<Record<keyof BranchFormData, string>>;
  submitting: boolean;
  onChange: (field: keyof BranchFormData, value: string) => void;
  onPaymentToggle: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Branch Name"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          error={errors.name}
          disabled={submitting}
          autoFocus
        />
        <Input
          label="Branch Code"
          value={form.branchCode}
          onChange={(e) => onChange("branchCode", e.target.value)}
          error={errors.branchCode}
          placeholder="e.g. BR001"
          disabled={submitting}
        />
        <div className="sm:col-span-2">
          <Input
            label="Location"
            value={form.location}
            onChange={(e) => onChange("location", e.target.value)}
            error={errors.location}
            placeholder="Short locator shown to customers"
            disabled={submitting}
          />
        </div>
        <Input
          label="City"
          value={form.city}
          onChange={(e) => onChange("city", e.target.value)}
          error={errors.city}
          disabled={submitting}
        />
        <Input
          label="Street"
          value={form.street}
          onChange={(e) => onChange("street", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Barangay"
          value={form.barangay}
          onChange={(e) => onChange("barangay", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Province"
          value={form.province}
          onChange={(e) => onChange("province", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Postal Code"
          value={form.postalCode}
          onChange={(e) => onChange("postalCode", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Contact Number"
          value={form.contactNumber}
          onChange={(e) => onChange("contactNumber", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Opening Time"
          type="time"
          value={form.openingTime}
          onChange={(e) => onChange("openingTime", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Closing Time"
          type="time"
          value={form.closingTime}
          onChange={(e) => onChange("closingTime", e.target.value)}
          disabled={submitting}
        />
        <div className="sm:col-span-2">
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => onChange("status", e.target.value)}
            disabled={submitting}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-ink mb-2">
            Payment Methods <span className="text-danger">*</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {PAYMENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer text-sm text-muted"
              >
                <input
                  type="checkbox"
                  checked={form.paymentMethods.includes(opt.value)}
                  onChange={() => onPaymentToggle(opt.value)}
                  disabled={submitting}
                  className="w-4 h-4 accent-[#007A53] cursor-pointer"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {errors.paymentMethods && (
            <p className="text-xs text-danger mt-2">{errors.paymentMethods}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {mode === "create" ? "Create Branch" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Branches() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const isSuperadmin = user?.role === "superadmin";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Delivery range editor state
  const [editing, setEditing] = useState<Branch | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [radiusKm, setRadiusKm] = useState(2);
  const [saving, setSaving] = useState(false);

  // CRUD state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<BranchFormData>(emptyForm());
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof BranchFormData, string>>>({});
  const [creating, setCreating] = useState(false);

  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState<BranchFormData>(emptyForm());
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof BranchFormData, string>>>({});
  const [editSaving, setEditSaving] = useState(false);

  const [viewBranch, setViewBranch] = useState<Branch | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cached per page/limit/search — placeholderData keeps the previous page's
  // rows visible while the next page loads instead of collapsing to skeleton.
  const { data, isFetching, error } = useQuery({
    queryKey: ["branches", "list", { page, limit, search: debouncedSearch }],
    queryFn: () =>
      api
        .get<BranchesResponse>("/admin/branches", {
          params: { page, limit, search: debouncedSearch || undefined },
        })
        .then((res) => res.data),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (error) toastError("Failed to load branches.");
  }, [error, toastError]);

  const branches = data?.branches ?? [];
  const meta = data?.pagination ?? null;
  const loading = isFetching && !data;

  // Superadmin CSV export — fetched from the untruncated superadmin endpoint.
  const exportAll = async () => {
    try {
      const res = await api.get("/superadmin/branches");
      const all: Branch[] = res.data?.branches ?? [];
      if (all.length === 0) {
        toastError("No branches to export.");
        return;
      }
      exportToCSV(all);
    } catch {
      toastError("Failed to export branches.");
    }
  };

  const invalidateBranchCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["branches"] });
  };

  const handleCreateChange = (field: keyof BranchFormData, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setCreateErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const togglePayment = (
    setter: React.Dispatch<React.SetStateAction<BranchFormData>>,
    value: string,
  ) => {
    setter((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(value)
        ? prev.paymentMethods.filter((m) => m !== value)
        : [...prev.paymentMethods, value],
    }));
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validateForm(createForm);
    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }
    setCreating(true);
    try {
      await api.post("/superadmin/branches", {
        ...createForm,
        branchCode: createForm.branchCode.trim().toUpperCase(),
      });
      success("Branch created successfully.");
      setShowCreate(false);
      invalidateBranchCaches();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create branch.",
      );
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (branch: Branch) => {
    setEditBranch(branch);
    setEditForm({
      name: branch.name,
      branchCode: branch.branchCode,
      location: branch.location,
      city: branch.address?.city ?? "",
      street: branch.address?.street ?? "",
      barangay: branch.address?.barangay ?? "",
      province: branch.address?.province ?? "",
      postalCode: branch.address?.postalCode ?? "",
      contactNumber: branch.contactNumber ?? "",
      email: branch.email ?? "",
      status: (branch.status as BranchStatus) ?? "active",
      openingTime: branch.openingTime ?? "",
      closingTime: branch.closingTime ?? "",
      paymentMethods: branch.paymentMethods ?? [],
    });
    setEditErrors({});
  };

  const handleEditChange = (field: keyof BranchFormData, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setEditErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editBranch) return;
    const errs = validateForm(editForm);
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditSaving(true);
    try {
      await api.patch(`/superadmin/branches/${editBranch._id}`, {
        ...editForm,
        branchCode: editForm.branchCode.trim().toUpperCase(),
      });
      success("Branch updated successfully.");
      setEditBranch(null);
      invalidateBranchCaches();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to update branch.",
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (confirmText: string) => {
    if (!deleteBranch) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/branches/${deleteBranch._id}`, {
        data: { confirmText },
      });
      success("Branch deleted successfully.");
      setDeleteBranch(null);
      invalidateBranchCaches();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to delete branch.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const hasCoords = (b: Branch) =>
    typeof b.coordinates?.lat === "number" && typeof b.coordinates?.lng === "number";

  const openEditor = (b: Branch) => {
    setEditing(b);
    setCenter(hasCoords(b) ? [b.coordinates!.lat!, b.coordinates!.lng!] : DEFAULT_CENTER);
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
        queryClient.setQueryData<BranchesResponse>(
          ["branches", "list", { page, limit, search: debouncedSearch }],
          (old) =>
            old
              ? {
                  ...old,
                  branches: old.branches.map((b) => (b._id === updated._id ? updated : b)),
                }
              : old,
        );
        invalidateBranchCaches();
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
    hasCoords(b) ? `${b.coordinates!.lat!.toFixed(4)}, ${b.coordinates!.lng!.toFixed(4)}` : "Not set";

  // Optional singleDeliveryFee chip in the view modal
  const viewPayments = useMemo(
    () => viewBranch?.paymentMethods?.map(paymentLabel).join(", ") || "—",
    [viewBranch],
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">Branches</h1>
          <p className="text-sm text-muted mt-0.5">
            Manage branch locations, hours and delivery range coverage
          </p>
        </div>
        {isSuperadmin && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={exportAll}>
              Export CSV
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setCreateForm(emptyForm());
                setCreateErrors({});
                setShowCreate(true);
              }}
            >
              Add Branch
            </Button>
          </div>
        )}
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
          <Search size={16} className="text-muted" />
          <input
            placeholder="Search branches..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"}`}
          />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDark ? "bg-sunken border-line" : "bg-sunken border-line"}`}>
                {["Branch", "Location", "Status", "Delivery Range", "Map Coordinates", "Actions"].map((h) => (
                  <th key={h} className={`px-4 py-3 text-left font-semibold whitespace-nowrap ${isDark ? "text-muted" : "text-muted"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
              ) : branches.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">No branches found.</td></tr>
              ) : (
                branches.map((b) => (
                  <tr key={b._id} className={`border-b ${isDark ? "border-line hover:bg-sunken" : "border-line hover:bg-sunken"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{b.name}</p>
                      <p className="text-xs text-muted">{b.branchCode}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {b.address?.city || b.location || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(String(b.status ?? "active"))}>
                        {statusLabel(String(b.status ?? "active"))}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isDark ? "bg-accent-soft text-accent-ink" : "bg-accent-soft text-accent"}`}>
                        {rangeLabel(b)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{coordsLabel(b)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewBranch(b)}
                          title="View details"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:bg-sunken cursor-pointer"
                        >
                          <Eye size={14} />
                        </button>
                        {isSuperadmin && (
                          <>
                            <button
                              onClick={() => openEdit(b)}
                              title="Edit branch"
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:bg-sunken cursor-pointer"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteBranch(b)}
                              title="Delete branch"
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-line text-danger hover:bg-danger-soft cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openEditor(b)}
                          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold bg-accent text-white hover:opacity-90 cursor-pointer"
                        >
                          <MapPin size={13} />
                          Set Range
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && meta && branches.length > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          label="branches"
        />
      )}

      {/* Delivery range editor */}
      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing ? `Delivery Range — ${editing.name}` : ""}
        width="max-w-3xl"
      >
        {editing && (
          <div>
            <div className="rounded-xl overflow-hidden border border-line">
              <DeliveryRangeMap
                center={center}
                radiusKm={radiusKm}
                onCenterChange={(lat, lng) => setCenter([lat, lng])}
              />
            </div>

            <p className="text-xs mt-3 mb-1 font-semibold text-muted">Delivery Radius</p>
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
              <div className={`flex items-center gap-1.5 px-3 h-10 rounded-xl border ${isDark ? "bg-surface border-line text-white" : "bg-white border-line text-ink"}`}>
                <Navigation size={14} className={isDark ? "text-accent-ink" : "text-accent"} />
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
                <span className="text-xs text-muted">km</span>
              </div>
            </div>

            <p className="text-xs mt-2 text-muted">
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

      {/* View branch */}
      <Modal
        open={!!viewBranch}
        onClose={() => setViewBranch(null)}
        title={viewBranch ? viewBranch.name : ""}
        width="max-w-lg"
      >
        {viewBranch && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-muted mb-0.5">Branch Code</p>
                <p className="text-ink">{viewBranch.branchCode}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted mb-0.5">Status</p>
                <Badge variant={statusVariant(String(viewBranch.status ?? "active"))}>
                  {statusLabel(String(viewBranch.status ?? "active"))}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted mb-0.5">Contact</p>
                <p className="text-ink">{viewBranch.contactNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted mb-0.5">Email</p>
                <p className="text-ink break-all">{viewBranch.email || "—"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted mb-0.5">Address</p>
              <p className="text-ink">
                {[viewBranch.address?.street, viewBranch.address?.barangay, viewBranch.location, viewBranch.address?.city, viewBranch.address?.province, viewBranch.address?.postalCode]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-muted mb-0.5">Hours</p>
                <p className="text-ink">
                  {viewBranch.openingTime || viewBranch.closingTime
                    ? `${viewBranch.openingTime || "—"} – ${viewBranch.closingTime || "—"}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted mb-0.5">Delivery Range</p>
                <p className="text-ink">{rangeLabel(viewBranch)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted mb-0.5">Payment Methods</p>
              <p className="text-ink">{viewPayments}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Create branch */}
      <Modal
        open={showCreate}
        onClose={() => !creating && setShowCreate(false)}
        title="Add Branch"
        width="max-w-2xl"
      >
        <BranchForm
          mode="create"
          form={createForm}
          errors={createErrors}
          submitting={creating}
          onChange={handleCreateChange}
          onPaymentToggle={(v) => togglePayment(setCreateForm, v)}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      </Modal>

      {/* Edit branch */}
      <Modal
        open={!!editBranch}
        onClose={() => !editSaving && setEditBranch(null)}
        title={editBranch ? `Edit Branch — ${editBranch.name}` : ""}
        width="max-w-2xl"
      >
        <BranchForm
          mode="edit"
          form={editForm}
          errors={editErrors}
          submitting={editSaving}
          onChange={handleEditChange}
          onPaymentToggle={(v) => togglePayment(setEditForm, v)}
          onClose={() => setEditBranch(null)}
          onSubmit={handleEdit}
        />
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteBranch}
        onClose={() => !deleting && setDeleteBranch(null)}
        onConfirm={handleDelete}
        title="Delete Branch"
        message={
          deleteBranch
            ? `This permanently deletes "${deleteBranch.name}" (${deleteBranch.branchCode}) and cannot be undone.`
            : ""
        }
        loading={deleting}
        confirmText="DELETE"
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
