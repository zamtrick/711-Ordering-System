import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Search, Eye, Download } from "lucide-react";
import api from "@/api/axios";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/ui/Pagination";

// ─── Types ────────────────────────────────────────────────────────────────────

type Branch = {
  _id: string;
  name: string;
  branchCode: string;
  location: string;
  address: {
    street: string;
    barangay: string;
    city: string;
    province: string;
    postalCode: string;
  };
  contactNumber: string;
  email: string;
  status: "active" | "inactive" | "maintenance";
  openingTime: string;
  closingTime: string;
  paymentMethods: string[];
  createdAt: string;
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
  status: "active" | "inactive" | "maintenance";
  openingTime: string;
  closingTime: string;
  paymentMethods: string[];
};

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

const defaultForm = (): BranchFormData => ({
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusVariant(status: string): "green" | "gray" | "orange" {
  if (status === "active") return "green";
  if (status === "maintenance") return "orange";
  return "gray";
}

function statusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "maintenance") return "Maintenance";
  return "Inactive";
}

function is401(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 401;
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    b.contactNumber,
    b.email,
    statusLabel(b.status),
    b.openingTime,
    b.closingTime,
    b.paymentMethods?.join(", ") ?? "",
    formatDateTime(b.createdAt),
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

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F0F0F0]">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" />
        </td>
      ))}
    </tr>
  );
}

// ─── Branch Form ──────────────────────────────────────────────────────────────

type BranchFormProps = {
  form: BranchFormData;
  formErrors: Partial<Record<keyof BranchFormData, string>>;
  submitting: boolean;
  onChange: (field: keyof BranchFormData, value: string) => void;
  onPaymentToggle: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  mode: "create" | "edit";
};

function BranchForm({
  form,
  formErrors,
  submitting,
  onChange,
  onPaymentToggle,
  onSubmit,
  onClose,
  mode,
}: BranchFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Branch Name *"
          placeholder="e.g. Main Branch"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          error={formErrors.name}
          disabled={submitting}
        />
        <Input
          label="Branch Code *"
          placeholder="e.g. BR001"
          value={form.branchCode}
          onChange={(e) => onChange("branchCode", e.target.value)}
          error={formErrors.branchCode}
          disabled={submitting}
        />
        <Input
          label="Location *"
          placeholder="e.g. North District"
          value={form.location}
          onChange={(e) => onChange("location", e.target.value)}
          error={formErrors.location}
          disabled={submitting}
        />
        <Input
          label="City *"
          placeholder="e.g. Manila"
          value={form.city}
          onChange={(e) => onChange("city", e.target.value)}
          error={formErrors.city}
          disabled={submitting}
        />
        <Input
          label="Street"
          placeholder="e.g. 123 Rizal Ave"
          value={form.street}
          onChange={(e) => onChange("street", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Barangay"
          placeholder="e.g. Barangay 1"
          value={form.barangay}
          onChange={(e) => onChange("barangay", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Province"
          placeholder="e.g. Metro Manila"
          value={form.province}
          onChange={(e) => onChange("province", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Postal Code"
          placeholder="e.g. 1000"
          value={form.postalCode}
          onChange={(e) => onChange("postalCode", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Contact Number"
          placeholder="e.g. 09171234567"
          value={form.contactNumber}
          onChange={(e) => onChange("contactNumber", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Email"
          type="email"
          placeholder="e.g. branch@example.com"
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Opening Time"
          placeholder="e.g. 07:00"
          value={form.openingTime}
          onChange={(e) => onChange("openingTime", e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Closing Time"
          placeholder="e.g. 22:00"
          value={form.closingTime}
          onChange={(e) => onChange("closingTime", e.target.value)}
          disabled={submitting}
        />
        <div className="sm:col-span-2">
          <Select
            label="Status"
            value={form.status}
            onChange={(e) =>
              onChange(
                "status",
                e.target.value as "active" | "inactive" | "maintenance",
              )
            }
            disabled={submitting}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-[#232323] dark:text-white mb-2">
            Payment Methods
          </p>
          <div className="flex flex-wrap gap-3">
            {PAYMENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer text-sm text-[#555] dark:text-[#A0A0A0]"
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
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        >
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
  const navigate = useNavigate();
  const { toasts, removeToast, success, error: toastError } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  // View modal
  const [viewBranch, setViewBranch] = useState<Branch | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<BranchFormData>(defaultForm());
  const [createErrors, setCreateErrors] = useState<
    Partial<Record<keyof BranchFormData, string>>
  >({});
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState<BranchFormData>(defaultForm());
  const [editErrors, setEditErrors] = useState<
    Partial<Record<keyof BranchFormData, string>>
  >({});
  const [editing, setEditing] = useState(false);

  // Delete dialog
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await api.get("/superadmin/branches");
      setBranches(res.data?.branches ?? []);
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404) {
        setBranches([]);
      } else {
        toastError("Failed to load branches.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.branchCode.toLowerCase().includes(search.toLowerCase()),
  );

  const pagination = usePagination({ items: filtered, pageSize: 10 });

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateForm(
    form: BranchFormData,
  ): Partial<Record<keyof BranchFormData, string>> {
    const errs: Partial<Record<keyof BranchFormData, string>> = {};
    if (!form.name.trim()) errs.name = "Branch name is required.";
    if (!form.branchCode.trim()) errs.branchCode = "Branch code is required.";
    if (!form.location.trim()) errs.location = "Location is required.";
    if (!form.city.trim()) errs.city = "City is required.";
    return errs;
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreateForm(defaultForm());
    setCreateErrors({});
    setShowCreate(true);
  };

  const handleCreateChange = (field: keyof BranchFormData, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setCreateErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCreatePaymentToggle = (value: string) => {
    setCreateForm((prev) => ({
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
      await api.post("/superadmin/branches", createForm);
      success("Branch created successfully.");
      setShowCreate(false);
      fetchBranches();
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to create branch.";
      toastError(msg);
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────

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
      contactNumber: branch.contactNumber,
      email: branch.email,
      status: branch.status,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
      paymentMethods: branch.paymentMethods ?? [],
    });
    setEditErrors({});
  };

  const handleEditChange = (field: keyof BranchFormData, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setEditErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleEditPaymentToggle = (value: string) => {
    setEditForm((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(value)
        ? prev.paymentMethods.filter((m) => m !== value)
        : [...prev.paymentMethods, value],
    }));
  };

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editBranch) return;
    const errs = validateForm(editForm);
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditing(true);
    try {
      await api.patch(`/superadmin/branches/${editBranch._id}`, editForm);
      success("Branch updated successfully.");
      setEditBranch(null);
      fetchBranches();
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update branch.";
      toastError(msg);
    } finally {
      setEditing(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteBranch) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/branches/${deleteBranch._id}`);
      success("Branch deleted successfully.");
      setDeleteBranch(null);
      fetchBranches();
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to delete branch.";
      toastError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (filtered.length === 0) {
      toastError("No branches to export.");
      return;
    }
    exportToCSV(filtered);
    success("Branches exported successfully.");
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Branches</h1>
          <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">
            Manage all store branches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Download size={16} />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
            Add Branch
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by name or code..."
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          leftIcon={<Search size={16} />}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8F5F2] dark:bg-[#2A2A2A] border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Branch Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Branch Code
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Location
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  City
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Contact
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]"
                  >
                    {search ? "No branches match your search." : "No branches found. Add one to get started."}
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((branch) => (
                  <tr
                    key={branch._id}
                    className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">
                      {branch.name}
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                      {branch.branchCode}
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{branch.location}</td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                      {branch.address?.city ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(branch.status)}>
                        {statusLabel(branch.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                      {branch.contactNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye size={14} />}
                          onClick={() => setViewBranch(branch)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={14} />}
                          onClick={() => openEdit(branch)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          onClick={() => setDeleteBranch(branch)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-[#E5E2DE] dark:border-[#2E2E2E]">
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setCurrentPage}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
            />
          </div>
        )}
      </div>

      {/* View Details Modal */}
      <Modal
        open={viewBranch !== null}
        onClose={() => setViewBranch(null)}
        title="Branch Details"
        width="max-w-2xl"
      >
        {viewBranch && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-[#E8F5EF] flex items-center justify-center">
                <span className="text-lg font-bold text-[#007A53]">
                  {viewBranch.branchCode?.slice(0, 3)}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-[#232323] dark:text-white">
                  {viewBranch.name}
                </p>
                <p className="text-sm text-[#777] dark:text-[#A0A0A0]">{viewBranch.branchCode}</p>
              </div>
              <div className="ml-auto">
                <Badge variant={statusVariant(viewBranch.status)}>
                  {statusLabel(viewBranch.status)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Location</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.location}
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">City</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.address?.city ?? "—"}
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Street</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.address?.street ?? "—"}
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Barangay</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.address?.barangay ?? "—"}
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Province</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.address?.province ?? "—"}
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Postal Code</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.address?.postalCode ?? "—"}
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Contact</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.contactNumber || "—"}
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Email</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.email || "—"}
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Hours</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewBranch.openingTime && viewBranch.closingTime
                    ? `${viewBranch.openingTime} – ${viewBranch.closingTime}`
                    : "—"}
                </p>
              </div>
              <div className="sm:col-span-3 bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Payment Methods</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {viewBranch.paymentMethods?.length > 0 ? (
                    viewBranch.paymentMethods.map((m) => (
                      <Badge key={m} variant="gray">
                        {m.replace("_", " ")}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-[#777] dark:text-[#A0A0A0]">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setViewBranch(null);
                  openEdit(viewBranch);
                }}
              >
                Edit Branch
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => !creating && setShowCreate(false)}
        title="Add Branch"
        width="max-w-2xl"
      >
        <BranchForm
          form={createForm}
          formErrors={createErrors}
          submitting={creating}
          onChange={handleCreateChange}
          onPaymentToggle={handleCreatePaymentToggle}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
          mode="create"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editBranch !== null}
        onClose={() => !editing && setEditBranch(null)}
        title="Edit Branch"
        width="max-w-2xl"
      >
        <BranchForm
          form={editForm}
          formErrors={editErrors}
          submitting={editing}
          onChange={handleEditChange}
          onPaymentToggle={handleEditPaymentToggle}
          onSubmit={handleEdit}
          onClose={() => setEditBranch(null)}
          mode="edit"
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteBranch !== null}
        onClose={() => !deleting && setDeleteBranch(null)}
        onConfirm={handleDelete}
        title="Delete Branch"
        message={`Are you sure you want to delete branch "${deleteBranch?.name}"? This action cannot be undone.`}
        loading={deleting}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
