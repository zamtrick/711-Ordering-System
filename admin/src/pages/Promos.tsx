import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Upload, X, Megaphone } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Promo = {
  _id: string;
  title: string;
  subtitle: string;
  image?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

type FormData = {
  title: string;
  subtitle: string;
  sortOrder: string;
  isActive: boolean;
  imageFile: File | null;
  imagePreview: string;
  removeImage: boolean;
};

const defaultForm = (): FormData => ({
  title: "",
  subtitle: "",
  sortOrder: "0",
  isActive: true,
  imageFile: null,
  imagePreview: "",
  removeImage: false,
});

// --------------------------------------------------
// FETCHERS
// --------------------------------------------------

type PromosResponse = { promos: Promo[] };

const fetchPromos = () =>
  api.get<PromosResponse>("/superadmin/promos").then((res) => res.data);

// Origin the API runs on — relative image paths need it prefixed.
const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
const toAbsolute = (image?: string) =>
  image && !/^https?:\/\//i.test(image) ? `${apiOrigin}${image}` : (image ?? "");

const revokePreview = (url: string) => {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
};

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

export default function Promos() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editPromo, setEditPromo] = useState<Promo | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [submitting, setSubmitting] = useState(false);

  const [deletePromo, setDeletePromo] = useState<Promo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --------------------------------------------------
  // QUERY
  // --------------------------------------------------

  const { data, isFetching, error } = useQuery({
    queryKey: ["promos"],
    queryFn: fetchPromos,
  });

  useEffect(() => {
    if (error) toastError("Failed to load promos.");
  }, [error, toastError]);

  const promos = data?.promos ?? [];
  const loading = isFetching && !data;

  const filtered = promos.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.subtitle ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // --------------------------------------------------
  // IMAGE HELPERS
  // --------------------------------------------------

  const uploadImage = async (promoId: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    await api.post(`/superadmin/promos/${promoId}/image`, fd);
  };

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    revokePreview(form.imagePreview);
    setForm({ ...form, imageFile: file, imagePreview: URL.createObjectURL(file), removeImage: false });
  };

  const clearPickedImage = () => {
    revokePreview(form.imagePreview);
    setForm({ ...form, imageFile: null, imagePreview: "", removeImage: true });
  };

  const closeForm = () => {
    revokePreview(form.imagePreview);
    setShowForm(false);
    setEditPromo(null);
    setForm(defaultForm());
  };

  // --------------------------------------------------
  // ACTIONS
  // --------------------------------------------------

  const openCreate = () => {
    setForm(defaultForm());
    setEditPromo(null);
    setShowForm(true);
  };

  const openEdit = (p: Promo) => {
    setEditPromo(p);
    setForm({
      title: p.title,
      subtitle: p.subtitle ?? "",
      sortOrder: String(p.sortOrder ?? 0),
      isActive: p.isActive,
      imageFile: null,
      imagePreview: toAbsolute(p.image),
      removeImage: false,
    });
    setShowForm(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toastError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.post("/superadmin/promos", {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      });
      const promoId = created.data?.promo?._id as string | undefined;

      if (promoId && form.imageFile) {
        await uploadImage(promoId, form.imageFile);
      }

      success("Promo created.");
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["promos"] });
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editPromo) return;
    if (!form.title.trim()) {
      toastError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/superadmin/promos/${editPromo._id}`, {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      });

      if (form.imageFile) {
        await uploadImage(editPromo._id, form.imageFile);
      } else if (form.removeImage) {
        await api.delete(`/superadmin/promos/${editPromo._id}/image`);
      }

      success("Promo updated.");
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["promos"] });
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed.");
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
      queryClient.invalidateQueries({ queryKey: ["promos"] });
    } catch {
      toastError("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  // --------------------------------------------------
  // STYLES
  // --------------------------------------------------

  const inputClass = "h-11 px-3 rounded-xl border text-sm outline-none transition-colors w-full bg-surface border-line text-ink focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Promos</h1>
          <p className="text-sm text-muted mt-0.5">Banners shown on the customer app home screen</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 cursor-pointer"
        >
          <Plus size={16} /> Add Promo
        </button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="flex items-center h-10 px-3 rounded-xl border bg-surface border-line gap-2">
          <Search size={16} className="text-faint" />
          <input
            placeholder="Search promos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 h-full outline-none bg-transparent text-sm text-ink placeholder:text-faint"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-surface border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-sunken">
                {["Image", "Title", "Subtitle", "Sort Order", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <Megaphone size={28} className="text-faint" />
                      <p className="font-medium">{search ? "No promos match your search." : "No promos yet"}</p>
                      {!search && <p className="text-xs">Create a banner to show it in the customer app.</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p._id} className={`border-b border-line hover:bg-sunken ${p.isActive ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3">
                      {toAbsolute(p.image) ? (
                        <img src={toAbsolute(p.image)} alt={p.title} className="w-16 h-10 rounded-lg object-cover border border-line" />
                      ) : (
                        <div className="w-16 h-10 rounded-lg flex items-center justify-center bg-sunken">
                          <Megaphone size={16} className="text-faint" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{p.title}</td>
                    <td className="px-4 py-3 text-muted max-w-[240px] truncate">{p.subtitle || "—"}</td>
                    <td className="px-4 py-3 text-muted">{p.sortOrder}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.isActive ? "bg-accent-soft text-accent-ink" : "bg-sunken text-muted"}`}>
                        {p.isActive ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg hover:bg-sunken cursor-pointer"
                          title="Edit promo"
                        >
                          <Pencil size={14} className="text-info" />
                        </button>
                        <button
                          onClick={() => setDeletePromo(p)}
                          className="p-1.5 rounded-lg hover:bg-danger-soft cursor-pointer"
                          title="Delete promo"
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
      </div>

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && closeForm()} />
          <div className="relative w-full max-w-lg rounded-2xl shadow-2xl z-10 p-6 bg-surface">
            <h3 className="text-lg font-bold text-ink mb-4">{editPromo ? "Edit Promo" : "Add Promo"}</h3>
            <form onSubmit={editPromo ? handleEdit : handleCreate}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-1 block text-muted">Title *</label>
                  <input className={inputClass} placeholder="e.g. Buy 1 Take 1 Tuesday" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={submitting} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-1 block text-muted">Subtitle</label>
                  <input className={inputClass} placeholder="Short supporting line" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} disabled={submitting} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">Sort Order</label>
                  <input type="number" className={inputClass} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} disabled={submitting} />
                  <p className="text-xs text-faint mt-1">Lower numbers appear first.</p>
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      disabled={submitting}
                      className="accent-accent"
                    />
                    Show in customer app
                  </label>
                </div>

                {/* Image picker */}
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-1 block text-muted">Banner Image (optional)</label>
                  <div className={`flex items-center gap-3 p-3 rounded-xl border border-dashed ${isDark ? "border-line" : "border-line"}`}>
                    {form.imagePreview ? (
                      <img src={form.imagePreview} alt="Preview" className="w-24 h-14 rounded-lg object-cover border border-line" />
                    ) : (
                      <div className="w-24 h-14 rounded-lg flex items-center justify-center bg-sunken">
                        <Megaphone size={20} className="text-faint" />
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold cursor-pointer bg-sunken text-ink hover:bg-line w-fit">
                        <Upload size={13} />
                        {form.imageFile ? "Change image" : form.imagePreview ? "Replace image" : "Upload image"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                          className="hidden"
                          disabled={submitting}
                          onChange={pickImage}
                        />
                      </label>

                      {form.imagePreview && (
                        <button
                          type="button"
                          onClick={clearPickedImage}
                          disabled={submitting}
                          className="inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold text-danger hover:bg-danger-soft cursor-pointer w-fit"
                        >
                          <X size={13} />
                          Remove image
                        </button>
                      )}

                      {!form.imagePreview && (
                        <p className="text-[11px] text-faint">JPG, PNG, WEBP, GIF or AVIF.</p>
                      )}
                    </div>
                  </div>
                </div>
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
        open={deletePromo !== null}
        onClose={() => !deleting && setDeletePromo(null)}
        onConfirm={handleDelete}
        title="Delete Promo"
        confirmText="DELETE"
        message={`Are you sure you want to delete "${deletePromo?.title}"? This action cannot be undone.`}
        loading={deleting}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
