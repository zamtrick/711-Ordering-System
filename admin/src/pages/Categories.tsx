import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Upload, X, Tags } from "lucide-react";
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

type Category = { _id: string; name: string; description: string; isActive: boolean; image?: string; createdAt: string };

type CategoriesResponse = { categories: Category[]; pagination?: PaginationMeta };

const fetchCategories = ({ page, limit, search }: { page: number; limit: number; search: string }) =>
  api
    .get<CategoriesResponse>("/admin/categories", {
      params: { page, limit, search: search || undefined },
    })
    .then((res) => res.data);

function SkeletonRow() {
  const { isDark } = useTheme();
  return (
    <tr className={`animate-pulse border-b ${isDark ? "border-line" : "border-line"}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className={`h-4 rounded ${isDark ? "bg-sunken" : "bg-sunken"}`} /></td>
      ))}
    </tr>
  );
}

export default function Categories() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const { can } = useAdminPermissions();
  const readOnly = !can("canManageCategories");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Origin the API runs on (http://localhost:5000 for this admin app).
  // Relative image paths returned by the API can be displayed by prefixing this.
  const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

  const toAbsolute = (image?: string) =>
    image && !/^https?:\/\//i.test(image)
      ? `${apiOrigin}${image}`
      : image;

  // Cached per page/limit/search — placeholderData keeps the previous page's
  // rows visible while the next page loads instead of collapsing to skeleton.
  const { data, isFetching, error } = useQuery({
    queryKey: ["categories", { page, limit, search: debouncedSearch }],
    queryFn: () => fetchCategories({ page, limit, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (error) toastError("Failed to load categories.");
  }, [error, toastError]);

  const categories = data?.categories ?? [];
  const meta = data?.pagination ?? null;
  const loading = isFetching && !data;

  // Deleted last row on the last page → step back to a valid page
  useEffect(() => {
    if (meta && page > meta.totalPages) setPage(Math.max(1, meta.totalPages));
  }, [meta, page]);

  const filtered = categories;

  const uploadImage = async (categoryId: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    await api.post(`/admin/categories/${categoryId}/image`, fd);
  };

  const removeCategoryImage = async (categoryId: string) => {
    await api.delete(`/admin/categories/${categoryId}/image`);
  };

  const revokePreview = (url: string) => {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    revokePreview(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const clearPickedImage = () => {
    revokePreview(imagePreview);
    setImageFile(null);
    setImagePreview("");
    setRemoveImage(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toastError("Name required."); return; }
    setSubmitting(true);
    try {
      const created = await api.post("/admin/categories", { name: name.trim(), description: description.trim() });
      const categoryId = created.data?.category?._id as string | undefined;

      if (categoryId && imageFile) {
        await uploadImage(categoryId, imageFile);
      }

      success("Created.");
      setShowForm(false);
      setName("");
      setDescription("");
      setImageFile(null);
      setImagePreview("");
      setRemoveImage(false);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCat) return;
    setSubmitting(true);
    try {
      await api.patch(`/admin/categories/${editCat._id}`, { name: name.trim(), description: description.trim() });

      if (imageFile) {
        // Uploading a new file replaces the current image (remove flag is moot)
        await uploadImage(editCat._id, imageFile);
      } else if (removeImage) {
        await removeCategoryImage(editCat._id);
      }

      success("Updated.");
      setEditCat(null);
      setImageFile(null);
      setImagePreview("");
      setRemoveImage(false);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
  };

  const handleDelete = async (confirmText?: string) => {
    if (!deleteCat) return;
    setDeleting(true);
    try { await api.delete(`/admin/categories/${deleteCat._id}`, { data: { confirmText } }); success("Deleted."); setDeleteCat(null); queryClient.invalidateQueries({ queryKey: ["categories"] }); } catch { toastError("Failed."); } finally { setDeleting(false); }
  };

  const inputClass = `h-11 px-3 rounded-xl border text-sm outline-none transition-colors w-full ${isDark ? "bg-surface border-line text-ink focus:border-accent" : "bg-white border-line text-ink focus:border-accent"} focus:ring-2 focus:ring-accent/20`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-ink">Categories</h1><p className="text-sm text-muted mt-0.5">Manage product categories</p></div>
        <button onClick={() => { setName(""); setDescription(""); setEditCat(null); setImageFile(null); setImagePreview(""); setRemoveImage(false); setShowForm(true); }} disabled={readOnly} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={16} /> Add Category</button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
          <Search size={16} className={isDark ? "text-muted" : "text-muted"} />
          <input placeholder="Search categories..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"}`} />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>          <table className="w-full text-sm">
            <thead><tr className={`border-b ${isDark ? "bg-sunken border-line" : "bg-sunken border-line"}`}>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-muted" : "text-muted"}`}>Image</th>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-muted" : "text-muted"}`}>Name</th>
            <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-muted" : "text-muted"}`}>Description</th>
            <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-muted" : "text-muted"}`}>Actions</th>
          </tr></thead>
          <tbody>              {loading ? <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
            : filtered.length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">No categories found.</td></tr>
            : filtered.map((c) => (
              <tr key={c._id} className={`border-b ${isDark ? "border-line hover:bg-sunken" : "border-line hover:bg-sunken"}`}>
                <td className="px-4 py-3">
                  {toAbsolute(c.image) ? (
                    <img src={toAbsolute(c.image)} alt={c.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                      <Tags size={16} className="text-faint" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                <td className="px-4 py-3 text-muted">{c.description || "—"}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1">
                  <button onClick={() => { setEditCat(c); setName(c.name); setDescription(c.description); setImageFile(null); if (c.image) { setImagePreview(toAbsolute(c.image) ?? ""); setRemoveImage(false); } else { setImagePreview(""); setRemoveImage(false); } setShowForm(true); }} disabled={readOnly} className="p-1.5 rounded-lg hover:bg-sunken cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Pencil size={14} className="text-info" /></button>
                  <button onClick={() => setDeleteCat(c)} disabled={readOnly} className="p-1.5 rounded-lg hover:bg-danger-soft cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={14} className="text-danger" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <div className={`relative w-full max-w-md rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-surface" : "bg-white"}`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-ink"}`}>{editCat ? "Edit Category" : "Add Category"}</h3>
            <form onSubmit={editCat ? handleEdit : handleCreate}>
              <div className="space-y-3">
                <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-muted" : "text-muted"}`}>Name *</label><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} /></div>
                <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-muted" : "text-muted"}`}>Description</label><textarea className={inputClass + " h-20 resize-none"} value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} /></div>

                {/* Optional image picker */}
                <div>
                  <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-muted" : "text-muted"}`}>Category Image (optional)</label>
                  <div className={`flex items-center gap-3 p-3 rounded-xl border border-dashed ${isDark ? "border-line" : "border-line"}`}>
                    {/* Preview / placeholder */}
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-16 h-16 rounded-lg object-cover border border-line"
                      />
                    ) : editCat && toAbsolute(editCat.image) ? (
                      <img
                        src={toAbsolute(editCat.image)}
                        alt="Current"
                        className="w-16 h-16 rounded-lg object-cover border border-line"
                      />
                    ) : (
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                        <Tags size={22} className="text-faint" />
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <label className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold cursor-pointer transition-colors ${isDark ? "bg-sunken text-white hover:bg-sunken" : "bg-sunken text-ink hover:bg-line"}`}>
                        <Upload size={13} />
                        {imageFile ? "Change image" : imagePreview || (editCat && toAbsolute(editCat.image)) ? "Replace image" : "Upload image"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                          className="hidden"
                          disabled={submitting}
                          onChange={pickImage}
                        />
                      </label>

                      {imagePreview || (editCat && toAbsolute(editCat.image)) ? (
                        <button
                          type="button"
                          onClick={clearPickedImage}
                          disabled={submitting}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer ${isDark ? "text-danger hover:bg-danger-soft" : "text-danger hover:bg-danger-soft"}`}
                        >
                          <X size={13} />
                          {removeImage ? "Image will be removed" : "Remove image"}
                        </button>
                      ) : (
                        <p className={`text-[11px] ${isDark ? "text-muted" : "text-faint"}`}>
                          JPG, PNG, WEBP, GIF or AVIF — max 5 MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowForm(false)} className={`px-4 h-10 rounded-xl text-sm font-medium border cursor-pointer ${isDark ? "border-line text-white" : "border-line text-ink"}`}>Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 cursor-pointer">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteCat !== null}
        onClose={() => !deleting && setDeleteCat(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        confirmText="DELETE"
        message={`Are you sure you want to delete "${deleteCat?.name}"? This action cannot be undone.`}
        loading={deleting}
      />

      {!loading && meta && categories.length > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          label="categories"
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
