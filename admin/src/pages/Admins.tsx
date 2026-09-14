import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Shield } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Branch = { _id: string; name: string; branchCode: string };

type AdminRow = {
  _id: string;
  user: {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
    isActive: boolean;
  };
  assignedBranch: Branch | null;
  createdAt: string;
};

type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type FormData = {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  assignedBranch: string;
  isActive: boolean;
};

const defaultForm = (): FormData => ({
  firstname: "",
  lastname: "",
  email: "",
  password: "",
  assignedBranch: "",
  isActive: true,
});

// --------------------------------------------------
// FETCHERS
// --------------------------------------------------

type AdminsResponse = { admins: AdminRow[]; pagination?: PaginationMeta };

const fetchAdmins = ({ page, limit, search }: { page: number; limit: number; search: string }) =>
  api
    .get<AdminsResponse>("/superadmin/admins", {
      params: { page, limit, search: search || undefined },
    })
    .then((res) => res.data);

type BranchesResponse = { branches: Branch[] };

const fetchBranches = () =>
  api.get<BranchesResponse>("/superadmin/branches").then((res) => res.data);

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-line">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 rounded bg-sunken" /></td>
      ))}
    </tr>
  );
}

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function Admins() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminRow | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [submitting, setSubmitting] = useState(false);

  const [deleteAdmin, setDeleteAdmin] = useState<AdminRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --------------------------------------------------
  // QUERIES
  // --------------------------------------------------

  const { data, isFetching, error } = useQuery({
    queryKey: ["admins", { page, limit, search: debouncedSearch }],
    queryFn: () => fetchAdmins({ page, limit, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  const { data: branchesData } = useQuery({
    queryKey: ["superadmin-branches"],
    queryFn: fetchBranches,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (error) toastError("Failed to load admins.");
  }, [error, toastError]);

  const admins = data?.admins ?? [];
  const meta = data?.pagination ?? null;
  const branches = branchesData?.branches ?? [];
  const loading = isFetching && !data;

  // Deleted last row on the last page → step back to a valid page
  useEffect(() => {
    if (meta && page > meta.totalPages) setPage(meta.totalPages);
  }, [meta, page]);

  // --------------------------------------------------
  // ACTIONS
  // --------------------------------------------------

  const openCreate = () => {
    setForm(defaultForm());
    setEditAdmin(null);
    setShowForm(true);
  };

  const openEdit = (a: AdminRow) => {
    setEditAdmin(a);
    setForm({
      firstname: a.user?.firstname ?? "",
      lastname: a.user?.lastname ?? "",
      email: a.user?.email ?? "",
      password: "",
      assignedBranch: a.assignedBranch?._id ?? "",
      isActive: a.user?.isActive ?? true,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditAdmin(null);
    setForm(defaultForm());
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      firstname: form.firstname,
      lastname: form.lastname,
      email: form.email,
      assignedBranch: form.assignedBranch,
      isActive: form.isActive,
    };
    if (form.password.trim()) payload.password = form.password;
    return payload;
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstname || !form.lastname || !form.email || !form.password || !form.assignedBranch) {
      toastError("All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/superadmin/admins", buildPayload());
      success("Admin created.");
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editAdmin) return;
    if (!form.firstname || !form.lastname || !form.email || !form.assignedBranch) {
      toastError("All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/superadmin/admins/${editAdmin._id}`, buildPayload());
      success("Admin updated.");
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (confirmText?: string) => {
    if (!deleteAdmin) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/admins/${deleteAdmin._id}`, { data: { confirmText } });
      success("Admin deleted.");
      setDeleteAdmin(null);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    } catch {
      toastError("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  // --------------------------------------------------
  // STYLES
  // --------------------------------------------------

  const inputClass = `h-11 px-3 rounded-xl border text-sm outline-none transition-colors w-full bg-surface border-line text-ink focus:border-accent focus:ring-2 focus:ring-accent/20`;
  const btnPrimary = "flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Admins</h1>
          <p className="text-sm text-muted mt-0.5">Create branch admins and manage their access</p>
        </div>
        <button onClick={openCreate} className={btnPrimary}><Plus size={16} /> Add Admin</button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="flex items-center h-10 px-3 rounded-xl border bg-surface border-line gap-2">
          <Search size={16} className="text-faint" />
          <input
            placeholder="Search admins..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 h-full outline-none bg-transparent text-sm text-ink placeholder:text-faint"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-surface border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken">
              {["Name", "Email", "Assigned Branch", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  <div className="flex flex-col items-center gap-2">
                    <Shield size={28} className="text-faint" />
                    <p className="font-medium">No admins yet</p>
                    <p className="text-xs">Create an admin and assign them to a branch.</p>
                  </div>
                </td>
              </tr>
            ) : (
              admins.map((a) => (
                <tr key={a._id} className="border-b border-line hover:bg-sunken">
                  <td className="px-4 py-3 font-medium text-ink">{a.user?.firstname} {a.user?.lastname}</td>
                  <td className="px-4 py-3 text-muted">{a.user?.email}</td>
                  <td className="px-4 py-3">
                    {a.assignedBranch ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent-ink">
                        {a.assignedBranch.name}
                        <span className="opacity-70">({a.assignedBranch.branchCode})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${a.user?.isActive ? "bg-accent-soft text-accent-ink" : "bg-danger-soft text-danger"}`}>
                      {a.user?.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg hover:bg-sunken cursor-pointer"
                        title="Edit admin"
                      >
                        <Pencil size={14} className="text-info" />
                      </button>
                      <button
                        onClick={() => setDeleteAdmin(a)}
                        className="p-1.5 rounded-lg hover:bg-danger-soft cursor-pointer"
                        title="Delete admin"
                      >
                        <Trash2 size={14} className="text-danger" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && meta && admins.length > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          label="admins"
        />
      )}

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && closeForm()} />
          <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-surface" : "bg-surface"}`}>
            <h3 className="text-lg font-bold text-ink mb-4">{editAdmin ? "Edit Admin" : "Add Admin"}</h3>
            <form onSubmit={editAdmin ? handleEdit : handleCreate}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">First Name *</label>
                  <input className={inputClass} value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} disabled={submitting} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">Last Name *</label>
                  <input className={inputClass} value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} disabled={submitting} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-1 block text-muted">Email *</label>
                  <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={submitting} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-1 block text-muted">
                    Password{editAdmin ? " (leave blank to keep current)" : " *"}
                  </label>
                  <input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={submitting} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-1 block text-muted">Assigned Branch *</label>
                  <select
                    className={inputClass}
                    value={form.assignedBranch}
                    onChange={(e) => setForm({ ...form, assignedBranch: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name} ({b.branchCode})</option>
                    ))}
                  </select>
                  <p className="text-xs text-faint mt-1">The admin will only see and manage their assigned branch.</p>
                </div>
                {editAdmin && (
                  <div className="col-span-2">
                    <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        disabled={submitting}
                        className="accent-accent"
                      />
                      Account active (admin can sign in)
                    </label>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={closeForm} disabled={submitting} className="px-4 h-10 rounded-xl text-sm font-medium border border-line text-ink cursor-pointer hover:bg-sunken">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 cursor-pointer disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteAdmin !== null}
        onClose={() => !deleting && setDeleteAdmin(null)}
        onConfirm={handleDelete}
        title="Delete Admin"
        confirmText="DELETE"
        message={`Are you sure you want to delete admin "${deleteAdmin?.user?.firstname ?? ""} ${deleteAdmin?.user?.lastname ?? ""}"? This also deletes their account and cannot be undone.`}
        loading={deleting}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
