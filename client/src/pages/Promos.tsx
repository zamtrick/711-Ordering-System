import { useEffect, useState, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Plus, Pencil, Trash2, Search, ImagePlus, ImageOff } from "lucide-react";
import api from "@/api/axios";
import { useToast } from "@/hooks/useToast";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ToastContainer from "@/components/ui/Toast";
import Badge from "@/components/ui/Badge";

type Promo = {
  _id: string;
  title: string;
  subtitle: string;
  image: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

const defaultForm = () => ({ title: "", subtitle: "", sortOrder: "0", isActive: true });

export default function Promos() {
  const { toasts, removeToast, success, error: toastError } = useToast();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editPromo, setEditPromo] = useState<Promo | null>(null);
  const [form, setForm] = useState(defaultForm());
  const [submitting, setSubmitting] = useState(false);
  const [deletePromo, setDeletePromo] = useState<Promo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/superadmin/promos");
      setPromos(res.data?.promos ?? []);
    } catch {
      toastError("Failed to load promos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = promos.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setEditPromo(null);
    setForm(defaultForm());
    setShowForm(true);
  };

  const openEdit = (p: Promo) => {
    setEditPromo(p);
    setForm({ title: p.title, subtitle: p.subtitle ?? "", sortOrder: String(p.sortOrder ?? 0), isActive: p.isActive });
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setShowForm(false);
    setEditPromo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toastError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (editPromo) {
        await api.patch(`/superadmin/promos/${editPromo._id}`, payload);
        success("Promo updated.");
      } else {
        await api.post("/superadmin/promos", payload);
        success("Promo created. Upload an image for it.");
      }
      closeForm();
      fetchData();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save promo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (confirmText?: string) => {
    if (!deletePromo) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/promos/${deletePromo._id}`, { data: { confirmText } });
      success("Promo deleted.");
      setDeletePromo(null);
      fetchData();
    } catch {
      toastError("Failed to delete promo.");
    } finally {
      setDeleting(false);
    }
  };

  const openImagePicker = (p: Promo) => {
    setUploadingFor(p._id);
    imageInputRef.current?.click();
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;
    try {
      const fd = new FormData();
      fd.append("image", file);
      await api.post(`/superadmin/promos/${uploadingFor}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      success("Promo image uploaded.");
      fetchData();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Image upload failed.");
    } finally {
      setUploadingFor(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleImageRemove = async (p: Promo) => {
    try {
      await api.delete(`/superadmin/promos/${p._id}/image`);
      success("Promo image removed.");
      fetchData();
    } catch {
      toastError("Failed to remove image.");
    }
  };

  const toggleActive = async (p: Promo) => {
    try {
      await api.patch(`/superadmin/promos/${p._id}`, { isActive: !p.isActive });
      setPromos((prev) => prev.map((x) => (x._id === p._id ? { ...x, isActive: !p.isActive } : x)));
    } catch {
      toastError("Failed to update status.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Promos</h1>
          <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">
            Manage customer home carousel — superadmin only
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
          Add Promo
        </Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Input placeholder="Search promos..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={16} />} />
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8F5F2] dark:bg-[#2A2A2A] border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
                {["Preview", "Title", "Status", "Order", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#777]">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]">
                    No promos found. Add one to fill the customer carousel.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p._id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3">
                      {p.image ? (
                        <img src={p.image} alt={p.title} className="w-24 h-14 rounded-lg object-cover border border-[#E5E2DE] dark:border-[#2E2E2E]" />
                      ) : (
                        <div className="w-24 h-14 rounded-lg bg-[#F0F0F0] dark:bg-[#2A2A2A] flex items-center justify-center text-xs text-[#777]">
                          No image
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#232323] dark:text-white">{p.title}</p>
                      <p className="text-xs text-[#777] dark:text-[#A0A0A0]">{p.subtitle || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(p)} title="Toggle active">
                        <Badge variant={p.isActive ? "green" : "gray"}>{p.isActive ? "active" : "hidden"}</Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{p.sortOrder}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" icon={<ImagePlus size={14} />} onClick={() => openImagePicker(p)}>
                          Image
                        </Button>
                        {p.image && (
                          <Button variant="ghost" size="sm" icon={<ImageOff size={14} />} onClick={() => handleImageRemove(p)}>
                            Clear
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeletePromo(p)}>
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
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      <Modal open={showForm} onClose={closeForm} title={editPromo ? "Edit Promo" : "Add Promo"}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <Input label="Title *" placeholder="e.g. Fresh deals just for you" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={submitting} />
            <Input label="Subtitle" placeholder="e.g. SPECIAL OFFER" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} disabled={submitting} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Order" type="number" placeholder="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} disabled={submitting} />
              <label className="flex items-center gap-2 text-sm mt-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  disabled={submitting}
                  className="w-4 h-4 accent-[#007A53]"
                />
                Show in carousel
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={closeForm} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Promo
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletePromo !== null}
        onClose={() => !deleting && setDeletePromo(null)}
        onConfirm={handleDelete}
        title="Delete Promo"
        confirmText="DELETE"
        message={`Delete "${deletePromo?.title}"? This removes it from the customer carousel.`}
        loading={deleting}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
