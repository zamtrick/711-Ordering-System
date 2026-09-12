import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import ToastContainer from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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
  createdAt: string;
};

type FormData = {
  firstname: string; lastname: string; email: string; password: string;
  phone: string; address: string; age: string; vehicleType: string; vehiclePlateNumber: string;
  assignedBranch: string;
};

const defaultForm = (): FormData => ({ firstname: "", lastname: "", email: "", password: "", phone: "", address: "", age: "", vehicleType: "", vehiclePlateNumber: "", assignedBranch: "" });

export default function Riders() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const { can } = useAdminPermissions();
  const readOnly = !can("canManageRiders");
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [editRider, setEditRider] = useState<Rider | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteRider, setDeleteRider] = useState<Rider | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [branches, setBranches] = useState<{ _id: string; name: string; branchCode: string }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ridersRes, branchesRes] = await Promise.all([
        api.get("/admin/riders"),
        api.get("/admin/branches"),
      ]);
      setRiders(ridersRes.data?.riders ?? []);
      setBranches(branchesRes.data?.branches ?? []);
    } catch { toastError("Failed."); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = riders.filter((r) => `${r.user?.firstname} ${r.user?.lastname}`.toLowerCase().includes(search.toLowerCase()));

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
    try { await api.post("/admin/riders", buildPayload()); success("Rider created."); closeForm(); fetchData(); } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editRider) return;
    setSubmitting(true);
    try { await api.patch(`/admin/riders/${editRider._id}`, buildPayload()); success("Updated."); closeForm(); fetchData(); } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
  };

  const handleDelete = async (confirmText?: string) => {
    if (!deleteRider) return;
    setDeleting(true);
    try { await api.delete(`/admin/riders/${deleteRider._id}`, { data: { confirmText } }); success("Deleted."); setDeleteRider(null); fetchData(); } catch { toastError("Failed."); } finally { setDeleting(false); }
  };

  const openEdit = (r: Rider) => {
    setEditRider(r);
    setForm({ firstname: r.user?.firstname ?? "", lastname: r.user?.lastname ?? "", email: r.user?.email ?? "", password: "", phone: r.phone ?? "", address: r.address ?? "", age: String(r.age ?? ""), vehicleType: r.vehicleType ?? "", vehiclePlateNumber: r.vehiclePlateNumber ?? "", assignedBranch: r.assignedBranch?._id ?? "" });
    setShowForm(true);
  };

  const inputClass = `h-11 px-3 rounded-xl border text-sm outline-none transition-colors w-full ${isDark ? "bg-[#121212] border-[#2E2E2E] text-white focus:border-[#078080]" : "bg-white border-[#E5E2DE] text-[#232323] focus:border-[#007A53]"} focus:ring-2 focus:ring-[#007A53]/20`;

  const statusColor = (s: string) => s === "available" ? "bg-[#E8F5EF] dark:bg-[#0A3D3D] text-[#007A53] dark:text-[#4CAF50]" : s === "delivering" ? "bg-[#EEF2FF] dark:bg-[#1A1A3D] text-[#4F46E5]" : "bg-[#F0F0F0] dark:bg-[#2A2A2A] text-[#777] dark:text-[#A0A0A0]";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-[#232323] dark:text-white">Riders</h1><p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">Manage delivery riders</p></div>
        <button onClick={() => { setForm(defaultForm()); setEditRider(null); setShowForm(true); }} disabled={readOnly} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-[#007A53] dark:bg-[#078080] hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={16} /> Add Rider</button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
          <Search size={16} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />
          <input placeholder="Search riders..." value={search} onChange={(e) => setSearch(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-[#555]" : "text-[#232323] placeholder:text-[#aaa]"}`} />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${isDark ? "bg-[#2A2A2A] border-[#2E2E2E]" : "bg-[#F8F5F2] border-[#E5E2DE]"}`}>
            {["Name", "Phone", "Vehicle", "Plate", "Status", "Actions"].map((h) => <th key={h} className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[#777]">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-[#777]">No riders found.</td></tr>
            : filtered.map((r) => (
              <tr key={r._id} className={`border-b ${isDark ? "border-[#2E2E2E] hover:bg-[#2A2A2A]" : "border-[#F0F0F0] hover:bg-[#FAFAFA]"}`}>
                <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{r.user?.firstname} {r.user?.lastname}</td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{r.phone}</td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{r.vehicleType}</td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{r.vehiclePlateNumber}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusColor(r.availabilityStatus)}`}>{r.availabilityStatus}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-1">
                  <button onClick={() => openEdit(r)} disabled={readOnly} className="p-1.5 rounded-lg hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Pencil size={14} className="text-[#4F46E5]" /></button>
                  <button onClick={() => setDeleteRider(r)} disabled={readOnly} className="p-1.5 rounded-lg hover:bg-[#FFF0F0] dark:hover:bg-[#3D1515] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={14} className="text-[#DA291C]" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && closeForm()} />
          <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-[#1E1E1E]" : "bg-white"}`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-[#232323]"}`}>{editRider ? "Edit Rider" : "Add Rider"}</h3>
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
                    <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>{f.label}</label>
                    <input type={f.type} className={inputClass} value={(form as Record<string, string>)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} disabled={submitting} />
                  </div>
                ))}
                <div className="col-span-2"><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Address *</label><input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={submitting} /></div>
                <div className="col-span-2">
                  <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Assigned Branch {editRider ? "" : "*"}</label>
                  <select className={inputClass} value={form.assignedBranch} onChange={(e) => setForm({ ...form, assignedBranch: e.target.value })} disabled={submitting}>
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name} ({b.branchCode})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={closeForm} disabled={submitting} className={`px-4 h-10 rounded-xl text-sm font-medium border cursor-pointer ${isDark ? "border-[#2E2E2E] text-white" : "border-[#E5E2DE]"}`}>Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-[#007A53] dark:bg-[#078080] hover:opacity-90 cursor-pointer disabled:opacity-50">Save</button>
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
