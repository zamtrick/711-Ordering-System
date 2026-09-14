import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import ToastContainer from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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

type Rider = {
  _id: string;
  user: { _id: string; firstname: string; lastname: string; email: string; isActive: boolean };
  assignedBranch: { _id: string; name: string; branchCode: string };
  phone: string;
  address: string;
  age: number;
  vehicleType: string;
  vehiclePlateNumber: string;
  availabilityStatus: string;
  activeDeliveries?: number;
  createdAt: string;
};

type FormData = {
  firstname: string; lastname: string; email: string; password: string;
  phone: string; address: string; age: string; vehicleType: string; vehiclePlateNumber: string;
  assignedBranch: string;
};

const defaultForm = (): FormData => ({ firstname: "", lastname: "", email: "", password: "", phone: "", address: "", age: "", vehicleType: "", vehiclePlateNumber: "", assignedBranch: "" });

type RidersResponse = { riders: Rider[]; pagination?: PaginationMeta };
type BranchOption = { _id: string; name: string; branchCode: string };
type BranchesResponse = { branches: BranchOption[] };

const fetchRiders = ({ page, limit, search }: { page: number; limit: number; search: string }) =>
  api
    .get<RidersResponse>("/admin/riders", {
      params: { page, limit, search: search || undefined },
    })
    .then((res) => res.data);

const fetchBranchOptions = () =>
  api.get<BranchesResponse>("/admin/branches").then((res) => res.data);

function SkeletonRow() {
  const { isDark } = useTheme();
  return (
    <tr className={`animate-pulse border-b ${isDark ? "border-line" : "border-line"}`}>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className={`h-4 rounded ${isDark ? "bg-sunken" : "bg-sunken"}`} /></td>
      ))}
    </tr>
  );
}

export default function Riders() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const { can } = useAdminPermissions();
  const readOnly = !can("canManageRiders");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [editRider, setEditRider] = useState<Rider | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteRider, setDeleteRider] = useState<Rider | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cached per page/limit/search — placeholderData keeps the previous page's
  // rows visible while the next page loads instead of collapsing to skeleton.
  const { data, isFetching, error } = useQuery({
    queryKey: ["riders", { page, limit, search: debouncedSearch }],
    queryFn: () => fetchRiders({ page, limit, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  // Branch dropdown options — cached and shared across pages.
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: fetchBranchOptions,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (error) toastError("Failed to load riders.");
  }, [error, toastError]);

  const riders = data?.riders ?? [];
  const meta = data?.pagination ?? null;
  const branches = branchesData?.branches ?? [];
  const loading = isFetching && !data;

  // Live rider cap (superadmin setting, default 3) for the load column.
  const { data: riderCap } = useQuery({
    queryKey: ["settings", "rider-capacity"],
    queryFn: () => api.get("/settings/rider-capacity").then((res) => res.data?.data?.capacity as number),
    staleTime: 60_000,
  });
  const cap = riderCap ?? 3;

  // Deleted last row on the last page → step back to a valid page
  useEffect(() => {
    if (meta && page > meta.totalPages) setPage(Math.max(1, meta.totalPages));
  }, [meta, page]);

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      firstname: form.firstname,
      lastname: form.lastname,
      email: form.email,
      phone: form.phone,
      address: form.address,
      vehicleType: form.vehicleType,
      vehiclePlateNumber: form.vehiclePlateNumber,
    };
    if (form.password.trim()) payload.password = form.password;
    if (form.assignedBranch) payload.assignedBranch = form.assignedBranch;
    const ageNum = Number(form.age);
    if (form.age !== "" && Number.isFinite(ageNum)) payload.age = ageNum;
    return payload;
  };

  const closeForm = () => {
    setShowForm(false);
    setEditRider(null);
    setForm(defaultForm());
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try { await api.post("/admin/riders", buildPayload()); success("Rider created."); closeForm(); queryClient.invalidateQueries({ queryKey: ["riders"] }); } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editRider) return;
    setSubmitting(true);
    try { await api.patch(`/admin/riders/${editRider._id}`, buildPayload()); success("Updated."); closeForm(); queryClient.invalidateQueries({ queryKey: ["riders"] }); } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
  };

  const handleDelete = async (confirmText?: string) => {
    if (!deleteRider) return;
    setDeleting(true);
    try { await api.delete(`/admin/riders/${deleteRider._id}`, { data: { confirmText } }); success("Deleted."); setDeleteRider(null); queryClient.invalidateQueries({ queryKey: ["riders"] }); } catch { toastError("Failed."); } finally { setDeleting(false); }
  };

  const openEdit = (r: Rider) => {
    setEditRider(r);
    setForm({ firstname: r.user?.firstname ?? "", lastname: r.user?.lastname ?? "", email: r.user?.email ?? "", password: "", phone: r.phone ?? "", address: r.address ?? "", age: String(r.age ?? ""), vehicleType: r.vehicleType ?? "", vehiclePlateNumber: r.vehiclePlateNumber ?? "", assignedBranch: r.assignedBranch?._id ?? "" });
    setShowForm(true);
  };

  const inputClass = `h-11 px-3 rounded-xl border text-sm outline-none transition-colors w-full ${isDark ? "bg-surface border-line text-ink focus:border-accent" : "bg-white border-line text-ink focus:border-accent"} focus:ring-2 focus:ring-accent/20`;

  const statusColor = (s: string) => s === "available" ? "bg-accent-soft text-accent-ink" : s === "delivering" ? "bg-info-soft text-info" : "bg-sunken dark:bg-sunken text-muted";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-ink">Riders</h1><p className="text-sm text-muted mt-0.5">Manage delivery riders</p></div>
        <button onClick={() => { setForm(defaultForm()); setEditRider(null); setShowForm(true); }} disabled={readOnly} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={16} /> Add Rider</button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
          <Search size={16} className={isDark ? "text-muted" : "text-muted"} />
          <input placeholder="Search riders..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"}`} />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${isDark ? "bg-sunken border-line" : "bg-sunken border-line"}`}>
            {["Name", "Phone", "Vehicle", "Plate", "Status", "Load", "Actions"].map((h) => <th key={h} className={`px-4 py-3 text-left font-semibold ${isDark ? "text-muted" : "text-muted"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
            : riders.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">No riders found.</td></tr>
            : riders.map((r) => (
              <tr key={r._id} className={`border-b ${isDark ? "border-line hover:bg-sunken" : "border-line hover:bg-sunken"}`}>
                <td className="px-4 py-3 font-medium text-ink">{r.user?.firstname} {r.user?.lastname}</td>
                <td className="px-4 py-3 text-muted">{r.phone}</td>
                <td className="px-4 py-3 text-muted">{r.vehicleType}</td>
                <td className="px-4 py-3 text-muted">{r.vehiclePlateNumber}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusColor(r.availabilityStatus)}`}>{r.availabilityStatus}</span></td>
                <td className="px-4 py-3 text-muted text-xs font-semibold">{r.activeDeliveries ?? 0}/{cap} active</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1">
                  <button onClick={() => openEdit(r)} disabled={readOnly} className="p-1.5 rounded-lg hover:bg-sunken cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Pencil size={14} className="text-info" /></button>
                  <button onClick={() => setDeleteRider(r)} disabled={readOnly} className="p-1.5 rounded-lg hover:bg-danger-soft cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={14} className="text-danger" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && closeForm()} />
          <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-surface" : "bg-white"}`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-ink"}`}>{editRider ? "Edit Rider" : "Add Rider"}</h3>
            <form onSubmit={editRider ? handleEdit : handleCreate}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "First Name *", key: "firstname", type: "text" },
                  { label: "Last Name *", key: "lastname", type: "text" },
                  { label: "Email *", key: "email", type: "email", span: true },
                  { label: "Password" + (editRider ? " (blank=keep)" : " *"), key: "password", type: "password", span: true },
                  { label: "Phone *", key: "phone", type: "text" },
                  { label: "Age *", key: "age", type: "number" },
                  { label: "Vehicle Type *", key: "vehicleType", type: "text" },
                  { label: "Plate Number *", key: "vehiclePlateNumber", type: "text" },
                ].map((f) => (
                  <div key={f.key} className={f.span ? "col-span-2" : ""}>
                    <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-muted" : "text-muted"}`}>{f.label}</label>
                    <input type={f.type} className={inputClass} value={(form as Record<string, string>)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} disabled={submitting} />
                  </div>
                ))}
                <div className="col-span-2"><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-muted" : "text-muted"}`}>Address *</label><input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={submitting} /></div>
                <div className="col-span-2">
                  <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-muted" : "text-muted"}`}>Assigned Branch {editRider ? "" : "*"}</label>
                  <select className={inputClass} value={form.assignedBranch} onChange={(e) => setForm({ ...form, assignedBranch: e.target.value })} disabled={submitting}>
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name} ({b.branchCode})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={closeForm} disabled={submitting} className={`px-4 h-10 rounded-xl text-sm font-medium border cursor-pointer ${isDark ? "border-line text-white" : "border-line"}`}>Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 cursor-pointer disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteRider !== null}
        onClose={() => !deleting && setDeleteRider(null)}
        onConfirm={handleDelete}
        title="Delete Rider"
        confirmText="DELETE"
        message={`Are you sure you want to delete rider "${deleteRider?.user?.firstname ?? ""} ${deleteRider?.user?.lastname ?? ""}"? This also deletes their account and cannot be undone.`}
        loading={deleting}
      />

      {!loading && meta && riders.length > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          label="riders"
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
