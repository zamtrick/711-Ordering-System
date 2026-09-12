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

type AdminUser = {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isActive: boolean;
};

type AssignedBranch = {
  _id: string;
  name: string;
  branchCode: string;
  location: string;
};

type Admin = {
  _id: string;
  user: AdminUser;
  assignedBranch: AssignedBranch;
  createdAt: string;
};

type BranchOption = {
  _id: string;
  name: string;
  branchCode: string;
};

type CreateFormData = {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  assignedBranch: string;
};

type EditFormData = {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  isActive: boolean;
  assignedBranch: string;
};

type CreateErrors = Partial<Record<keyof CreateFormData, string>>;
type EditErrors = Partial<Record<keyof EditFormData, string>>;

const defaultCreate = (): CreateFormData => ({
  firstname: "",
  lastname: "",
  email: "",
  password: "",
  assignedBranch: "",
});

const defaultEdit = (): EditFormData => ({
  firstname: "",
  lastname: "",
  email: "",
  password: "",
  isActive: true,
  assignedBranch: "",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function is401(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 401;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function getApiMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback
  );
}

function exportToCSV(admins: Admin[]) {
  const headers = ["Name", "Email", "Assigned Branch", "Status", "Created"];
  const rows = admins.map((a) => [
    `${a.user?.firstname ?? ""} ${a.user?.lastname ?? ""}`,
    a.user?.email ?? "",
    a.assignedBranch ? `${a.assignedBranch.name} (${a.assignedBranch.branchCode})` : "—",
    a.user?.isActive ? "Active" : "Inactive",
    formatDate(a.createdAt),
  ]);

  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `admins_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F0F0F0]">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Admins() {
  const navigate = useNavigate();
  const { toasts, removeToast, success, error: toastError } = useToast();

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  // View modal
  const [viewAdmin, setViewAdmin] = useState<Admin | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormData>(defaultCreate());
  const [createErrors, setCreateErrors] = useState<CreateErrors>({});
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>(defaultEdit());
  const [editErrors, setEditErrors] = useState<EditErrors>({});
  const [editing, setEditing] = useState(false);

  // Delete dialog
  const [deleteAdmin, setDeleteAdmin] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsRes, branchesRes] = await Promise.all([
        api.get("/superadmin/admins").catch((err) => {
          if (
            (err as { response?: { status?: number } })?.response?.status ===
            404
          ) {
            return { data: { admins: [] } };
          }
          throw err;
        }),
        api.get("/superadmin/branches").catch((err) => {
          if (
            (err as { response?: { status?: number } })?.response?.status ===
            404
          ) {
            return { data: { branches: [] } };
          }
          throw err;
        }),
      ]);
      setAdmins(adminsRes.data?.admins ?? []);
      setBranches(branchesRes.data?.branches ?? []);
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      toastError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = admins.filter((a) => {
    const fullName =
      `${a.user?.firstname ?? ""} ${a.user?.lastname ?? ""}`.toLowerCase();
    const email = (a.user?.email ?? "").toLowerCase();
    const q = search.toLowerCase();
    return fullName.includes(q) || email.includes(q);
  });

  const pagination = usePagination({ items: filtered, pageSize: 10 });

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateCreate(form: CreateFormData): CreateErrors {
    const errs: CreateErrors = {};
    if (!form.firstname.trim()) errs.firstname = "First name is required.";
    if (!form.lastname.trim()) errs.lastname = "Last name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    if (!form.password) errs.password = "Password is required.";
    if (!form.assignedBranch) errs.assignedBranch = "Assigned branch is required.";
    return errs;
  }

  function validateEdit(form: EditFormData): EditErrors {
    const errs: EditErrors = {};
    if (!form.firstname.trim()) errs.firstname = "First name is required.";
    if (!form.lastname.trim()) errs.lastname = "Last name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    if (!form.assignedBranch) errs.assignedBranch = "Assigned branch is required.";
    return errs;
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreateForm(defaultCreate());
    setCreateErrors({});
    setShowCreate(true);
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validateCreate(createForm);
    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }
    setCreating(true);
    try {
      await api.post("/superadmin/admins", {
        firstname: createForm.firstname,
        lastname: createForm.lastname,
        email: createForm.email,
        password: createForm.password,
        assignedBranch: createForm.assignedBranch,
      });
      success("Admin created successfully.");
      setShowCreate(false);
      fetchData();
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      toastError(getApiMessage(err, "Failed to create admin."));
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────

  const openEdit = (admin: Admin) => {
    setEditAdmin(admin);
    setEditForm({
      firstname: admin.user?.firstname ?? "",
      lastname: admin.user?.lastname ?? "",
      email: admin.user?.email ?? "",
      password: "",
      isActive: admin.user?.isActive ?? true,
      assignedBranch: admin.assignedBranch?._id ?? "",
    });
    setEditErrors({});
  };

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editAdmin) return;
    const errs = validateEdit(editForm);
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditing(true);
    try {
      const payload: Record<string, unknown> = {
        firstname: editForm.firstname,
        lastname: editForm.lastname,
        email: editForm.email,
        isActive: editForm.isActive,
        assignedBranch: editForm.assignedBranch,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }
      await api.patch(`/superadmin/admins/${editAdmin._id}`, payload);
      success("Admin updated successfully.");
      setEditAdmin(null);
      fetchData();
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      toastError(getApiMessage(err, "Failed to update admin."));
    } finally {
      setEditing(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (confirmText?: string) => {
    if (!deleteAdmin) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/admins/${deleteAdmin._id}`, { data: { confirmText } });
      success("Admin deleted successfully.");
      setDeleteAdmin(null);
      fetchData();
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      toastError(getApiMessage(err, "Failed to delete admin."));
    } finally {
      setDeleting(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (filtered.length === 0) {
      toastError("No admins to export.");
      return;
    }
    exportToCSV(filtered);
    success("Admins exported successfully.");
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Admins</h1>
          <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">Manage branch administrators</p>
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
            Add Admin
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by name or email..."
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
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Assigned Branch
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Created
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
                    colSpan={6}
                    className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]"
                  >
                    {search
                      ? "No admins match your search."
                      : "No admins found. Add one to get started."}
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((admin) => (
                  <tr
                    key={admin._id}
                    className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">
                      {admin.user?.firstname} {admin.user?.lastname}
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                      {admin.user?.email}
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                      {admin.assignedBranch
                        ? `${admin.assignedBranch.name} (${admin.assignedBranch.branchCode})`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={admin.user?.isActive ? "green" : "red"}>
                        {admin.user?.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                      {formatDate(admin.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye size={14} />}
                          onClick={() => setViewAdmin(admin)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={14} />}
                          onClick={() => openEdit(admin)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          onClick={() => setDeleteAdmin(admin)}
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
        open={viewAdmin !== null}
        onClose={() => setViewAdmin(null)}
        title="Admin Details"
        width="max-w-lg"
      >
        {viewAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] flex items-center justify-center">
                <span className="text-lg font-bold text-[#4F46E5]">
                  {viewAdmin.user?.firstname?.[0]}
                  {viewAdmin.user?.lastname?.[0]}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-[#232323] dark:text-white">
                  {viewAdmin.user?.firstname} {viewAdmin.user?.lastname}
                </p>
                <p className="text-sm text-[#777] dark:text-[#A0A0A0]">{viewAdmin.user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-4">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Status</p>
                <Badge variant={viewAdmin.user?.isActive ? "green" : "red"}>
                  {viewAdmin.user?.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-4">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Role</p>
                <Badge variant="blue">Admin</Badge>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-4">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Assigned Branch</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {viewAdmin.assignedBranch?.name ?? "—"}{" "}
                  <span className="text-[#777] dark:text-[#A0A0A0]">
                    ({viewAdmin.assignedBranch?.branchCode ?? "—"})
                  </span>
                </p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-4">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Created</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {formatDateTime(viewAdmin.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setViewAdmin(null);
                  openEdit(viewAdmin);
                }}
              >
                Edit Admin
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => !creating && setShowCreate(false)}
        title="Add Admin"
        width="max-w-lg"
      >
        <form onSubmit={handleCreate} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name *"
              placeholder="e.g. Juan"
              value={createForm.firstname}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, firstname: e.target.value }))
              }
              error={createErrors.firstname}
              disabled={creating}
            />
            <Input
              label="Last Name *"
              placeholder="e.g. Dela Cruz"
              value={createForm.lastname}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, lastname: e.target.value }))
              }
              error={createErrors.lastname}
              disabled={creating}
            />
            <div className="sm:col-span-2">
              <Input
                label="Email *"
                type="email"
                placeholder="e.g. admin@example.com"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, email: e.target.value }))
                }
                error={createErrors.email}
                disabled={creating}
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Password *"
                type="password"
                placeholder="Enter password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, password: e.target.value }))
                }
                error={createErrors.password}
                disabled={creating}
              />
            </div>
            <div className="sm:col-span-2">
              <Select
                label="Assigned Branch *"
                value={createForm.assignedBranch}
                onChange={(e) =>
                  setCreateForm((p) => ({
                    ...p,
                    assignedBranch: e.target.value,
                  }))
                }
                error={createErrors.assignedBranch}
                disabled={creating}
              >
                <option value="">Select a branch...</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.branchCode})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Create Admin
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editAdmin !== null}
        onClose={() => !editing && setEditAdmin(null)}
        title="Edit Admin"
        width="max-w-lg"
      >
        <form onSubmit={handleEdit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name *"
              placeholder="e.g. Juan"
              value={editForm.firstname}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, firstname: e.target.value }))
              }
              error={editErrors.firstname}
              disabled={editing}
            />
            <Input
              label="Last Name *"
              placeholder="e.g. Dela Cruz"
              value={editForm.lastname}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, lastname: e.target.value }))
              }
              error={editErrors.lastname}
              disabled={editing}
            />
            <div className="sm:col-span-2">
              <Input
                label="Email *"
                type="email"
                placeholder="e.g. admin@example.com"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, email: e.target.value }))
                }
                error={editErrors.email}
                disabled={editing}
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Password (leave blank to keep unchanged)"
                type="password"
                placeholder="Enter new password"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, password: e.target.value }))
                }
                disabled={editing}
              />
            </div>
            <div className="sm:col-span-2">
              <Select
                label="Assigned Branch *"
                value={editForm.assignedBranch}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    assignedBranch: e.target.value,
                  }))
                }
                error={editErrors.assignedBranch}
                disabled={editing}
              >
                <option value="">Select a branch...</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.branchCode})
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Select
                label="Status"
                value={editForm.isActive ? "active" : "inactive"}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    isActive: e.target.value === "active",
                  }))
                }
                disabled={editing}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditAdmin(null)}
              disabled={editing}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={editing}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteAdmin !== null}
        onClose={() => !deleting && setDeleteAdmin(null)}
        onConfirm={handleDelete}
        title="Delete Admin"
        confirmText="DELETE"
        message={`Are you sure you want to delete admin ${deleteAdmin?.user?.firstname ?? ""} ${deleteAdmin?.user?.lastname ?? ""}? This will also delete their account.`}
        loading={deleting}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
