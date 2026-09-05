import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import api from "@/api/axios";
import { useToast } from "@/hooks/useToast";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ToastContainer from "@/components/ui/Toast";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/ui/Pagination";

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

type BranchOption = { _id: string; name: string; branchCode: string };
type FormData = {
  firstname: string; lastname: string; email: string; password: string;
  phone: string; address: string; age: string; vehicleType: string; vehiclePlateNumber: string;
  assignedBranch: string;
};

const defaultForm = (): FormData => ({ firstname: "", lastname: "", email: "", password: "", phone: "", address: "", age: "", vehicleType: "", vehiclePlateNumber: "", assignedBranch: "" });

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F0F0F0]">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" /></td>
      ))}
    </tr>
  );
}

function statusVariant(s: string): "green" | "blue" | "gray" {
  if (s === "available") return "green";
  if (s === "delivering") return "blue";
  return "gray";
}

export default function Riders() {
  const { toasts, removeToast, success, error: toastError } = useToast();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [editRider, setEditRider] = useState<Rider | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteRider, setDeleteRider] = useState<Rider | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, bRes] = await Promise.all([
        api.get("/admin/riders").catch(() => ({ data: { riders: [] } })),
        api.get("/superadmin/branches").catch(() => ({ data: { branches: [] } })),
      ]);
      setRiders(rRes.data?.riders ?? []);
      setBranches(bRes.data?.branches ?? []);
    } catch { toastError("Failed to load data."); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = riders.filter((r) => `${r.user?.firstname} ${r.user?.lastname}`.toLowerCase().includes(search.toLowerCase()) || r.vehiclePlateNumber?.toLowerCase().includes(search.toLowerCase()));

  const pagination = usePagination({ items: filtered, pageSize: 10 });

  function validateRider(f: FormData, isEdit: boolean): Partial<Record<keyof FormData, string>> {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!f.firstname.trim()) errs.firstname = "First name is required.";
    if (!f.lastname.trim()) errs.lastname = "Last name is required.";
    if (!f.email.trim()) errs.email = "Email is required.";
    if (!isEdit && !f.password) errs.password = "Password is required.";
    if (!f.phone.trim()) errs.phone = "Phone is required.";
    if (!f.address.trim()) errs.address = "Address is required.";
    if (!f.age || Number(f.age) < 18) errs.age = "Age must be 18+.";
    if (!f.vehicleType.trim()) errs.vehicleType = "Vehicle type is required.";
    if (!f.vehiclePlateNumber.trim()) errs.vehiclePlateNumber = "Plate number is required.";
    if (!f.assignedBranch) errs.assignedBranch = "Branch is required.";
    return errs;
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateRider(form, false);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post("/admin/riders", { ...form, age: Number(form.age) });
      success("Rider created successfully.");
      setShowForm(false); setForm(defaultForm()); setFormErrors({}); fetchData();
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create rider."); } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editRider) return;
    const errs = validateRider(form, true);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...form, age: Number(form.age) };
      if (!payload.password) delete payload.password;
      await api.patch(`/admin/riders/${editRider._id}`, payload);
      success("Rider updated successfully.");
      setEditRider(null); setForm(defaultForm()); setFormErrors({}); fetchData();
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update rider."); } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteRider) return;
    setDeleting(true);
    try { await api.delete(`/admin/riders/${deleteRider._id}`); success("Rider deleted successfully."); setDeleteRider(null); fetchData(); } catch { toastError("Failed to delete rider."); } finally { setDeleting(false); }
  };

  const openEdit = (r: Rider) => {
    setEditRider(r);
    setForm({ firstname: r.user?.firstname ?? "", lastname: r.user?.lastname ?? "", email: r.user?.email ?? "", password: "", phone: r.phone, address: r.address, age: String(r.age), vehicleType: r.vehicleType, vehiclePlateNumber: r.vehiclePlateNumber, assignedBranch: r.assignedBranch?._id ?? "" });
    setFormErrors({});
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Riders</h1>
          <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">Manage delivery riders</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setForm(defaultForm()); setEditRider(null); setFormErrors({}); setShowForm(true); }}>Add Rider</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Input placeholder="Search by name or plate number..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={16} />} />
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8F5F2] dark:bg-[#2A2A2A] border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
                {["Name", "Phone", "Vehicle", "Plate", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]">No riders found.</td></tr>
              ) : pagination.paginatedItems.map((r) => (
                <tr key={r._id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{r.user?.firstname} {r.user?.lastname}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{r.phone}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{r.vehicleType}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0] font-mono text-xs">{r.vehiclePlateNumber}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(r.availabilityStatus)}>{r.availabilityStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(r)}>Edit</Button>
                      <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteRider(r)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Create / Edit Modal */}
      <Modal open={showForm} onClose={() => !submitting && setShowForm(false)} title={editRider ? "Edit Rider" : "Add Rider"} width="max-w-2xl">
        <form onSubmit={editRider ? handleEdit : handleCreate} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name *" placeholder="First name" value={form.firstname} onChange={(e) => { setForm({ ...form, firstname: e.target.value }); setFormErrors({ ...formErrors, firstname: undefined }); }} error={formErrors.firstname} disabled={submitting} />
            <Input label="Last Name *" placeholder="Last name" value={form.lastname} onChange={(e) => { setForm({ ...form, lastname: e.target.value }); setFormErrors({ ...formErrors, lastname: undefined }); }} error={formErrors.lastname} disabled={submitting} />
            <Input label="Email *" type="email" placeholder="Email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFormErrors({ ...formErrors, email: undefined }); }} error={formErrors.email} disabled={submitting} />
            <Input label={editRider ? "Password (blank=keep)" : "Password *"} type="password" placeholder="Password" value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setFormErrors({ ...formErrors, password: undefined }); }} error={formErrors.password} disabled={submitting} />
            <Input label="Phone *" placeholder="Phone" value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFormErrors({ ...formErrors, phone: undefined }); }} error={formErrors.phone} disabled={submitting} />
            <Input label="Age *" type="number" placeholder="18" value={form.age} onChange={(e) => { setForm({ ...form, age: e.target.value }); setFormErrors({ ...formErrors, age: undefined }); }} error={formErrors.age} disabled={submitting} />
            <Input label="Vehicle Type *" placeholder="e.g. Motorcycle" value={form.vehicleType} onChange={(e) => { setForm({ ...form, vehicleType: e.target.value }); setFormErrors({ ...formErrors, vehicleType: undefined }); }} error={formErrors.vehicleType} disabled={submitting} />
            <Input label="Plate Number *" placeholder="ABC 1234" value={form.vehiclePlateNumber} onChange={(e) => { setForm({ ...form, vehiclePlateNumber: e.target.value }); setFormErrors({ ...formErrors, vehiclePlateNumber: undefined }); }} error={formErrors.vehiclePlateNumber} disabled={submitting} />
            <div className="col-span-2">
              <Input label="Address *" placeholder="Address" value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); setFormErrors({ ...formErrors, address: undefined }); }} error={formErrors.address} disabled={submitting} />
            </div>
            <div className="col-span-2">
              <Select label="Assigned Branch *" value={form.assignedBranch} onChange={(e) => { setForm({ ...form, assignedBranch: e.target.value }); setFormErrors({ ...formErrors, assignedBranch: undefined }); }} error={formErrors.assignedBranch} disabled={submitting}>
                <option value="">Select branch...</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.branchCode})</option>)}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting}>Save Rider</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteRider !== null}
        onClose={() => !deleting && setDeleteRider(null)}
        onConfirm={handleDelete}
        title="Delete Rider"
        message={`Are you sure you want to delete "${deleteRider?.user?.firstname} ${deleteRider?.user?.lastname}"? This will also delete their user account.`}
        loading={deleting}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
