import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Plus, Pencil, Trash2, Search, Upload, X, Tags } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";

type Category = { _id: string; name: string; description: string; isActive: boolean; image?: string; createdAt: string };

export default function Categories() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/categories");
      setCategories(res.data?.categories ?? []);
    } catch { toastError("Failed."); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const uploadImage = async (categoryId: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    await api.post(`/admin/categories/${categoryId}/image`, fd);
  };

  const removeCategoryImage = async (categoryId: string) => {
    await api.delete(`/admin/categories/${categoryId}/image`);
  };

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const clearPickedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
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
      fetchData();
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
      fetchData();
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteCat) return;
    setDeleting(true);
    try { await api.delete(`/admin/categories/${deleteCat._id}`); success("Deleted."); setDeleteCat(null); fetchData(); } catch { toastError("Failed."); } finally { setDeleting(false); }
  };

  const inputClass = `h-11 px-3 rounded-xl border text-sm outline-none transition-colors w-full ${isDark ? "bg-[#121212] border-[#2E2E2E] text-white focus:border-[#078080]" : "bg-white border-[#E5E2DE] text-[#232323] focus:border-[#007A53]"} focus:ring-2 focus:ring-[#007A53]/20`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-[#232323] dark:text-white">Categories</h1><p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">Manage product categories</p></div>
        <button onClick={() => { setName(""); setDescription(""); setEditCat(null); setImageFile(null); setImagePreview(""); setRemoveImage(false); setShowForm(true); }} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-[#007A53] dark:bg-[#078080] hover:opacity-90 cursor-pointer"><Plus size={16} /> Add Category</button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
          <Search size={16} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />
          <input placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-[#555]" : "text-[#232323] placeholder:text-[#aaa]"}`} />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>          <table className="w-full text-sm">
            <thead><tr className={`border-b ${isDark ? "bg-[#2A2A2A] border-[#2E2E2E]" : "bg-[#F8F5F2] border-[#E5E2DE]"}`}>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Image</th>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Name</th>
            <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Description</th>
            <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Actions</th>
          </tr></thead>
          <tbody>              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-[#777]">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-[#777]">No categories found.</td></tr>
            : filtered.map((c) => (
              <tr key={c._id} className={`border-b ${isDark ? "border-[#2E2E2E] hover:bg-[#2A2A2A]" : "border-[#F0F0F0] hover:bg-[#FAFAFA]"}`}>
                <td className="px-4 py-3">
                  {toAbsolute(c.image) ? (
                    <img src={toAbsolute(c.image)} alt={c.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                      <Tags size={16} className="text-[#aaa]" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{c.name}</td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{c.description || "—"}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1">
                  <button onClick={() => { setEditCat(c); setName(c.name); setDescription(c.description); setImageFile(null); if (c.image) { setImagePreview(toAbsolute(c.image) ?? ""); setRemoveImage(false); } else { setImagePreview(""); setRemoveImage(false); } setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] cursor-pointer"><Pencil size={14} className="text-[#4F46E5]" /></button>
                  <button onClick={() => setDeleteCat(c)} className="p-1.5 rounded-lg hover:bg-[#FFF0F0] dark:hover:bg-[#3D1515] cursor-pointer"><Trash2 size={14} className="text-[#DA291C]" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <div className={`relative w-full max-w-md rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-[#1E1E1E]" : "bg-white"}`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-[#232323]"}`}>{editCat ? "Edit Category" : "Add Category"}</h3>
            <form onSubmit={editCat ? handleEdit : handleCreate}>
              <div className="space-y-3">
                <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Name *</label><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} /></div>
                <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Description</label><textarea className={inputClass + " h-20 resize-none"} value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} /></div>

                {/* Optional image picker */}
                <div>
                  <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Category Image (optional)</label>
                  <div className={`flex items-center gap-3 p-3 rounded-xl border border-dashed ${isDark ? "border-[#2E2E2E]" : "border-[#E5E2DE]"}`}>
                    {/* Preview / placeholder */}
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-16 h-16 rounded-lg object-cover border border-[#E5E2DE] dark:border-[#2E2E2E]"
                      />
                    ) : editCat && toAbsolute(editCat.image) ? (
                      <img
                        src={toAbsolute(editCat.image)}
                        alt="Current"
                        className="w-16 h-16 rounded-lg object-cover border border-[#E5E2DE] dark:border-[#2E2E2E]"
                      />
                    ) : (
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                        <Tags size={22} className="text-[#aaa]" />
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <label className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold cursor-pointer transition-colors ${isDark ? "bg-[#2A2A2A] text-white hover:bg-[#333]" : "bg-[#F0ECE6] text-[#232323] hover:bg-[#E5E2DE]"}`}>
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
                          className={`inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer ${isDark ? "text-[#FF6B61] hover:bg-[#3D1515]" : "text-[#DA291C] hover:bg-[#FFF0F0]"}`}
                        >
                          <X size={13} />
                          {removeImage ? "Image will be removed" : "Remove image"}
                        </button>
                      ) : (
                        <p className={`text-[11px] ${isDark ? "text-[#777]" : "text-[#aaa]"}`}>
                          JPG, PNG, WEBP, GIF or AVIF — max 5 MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowForm(false)} className={`px-4 h-10 rounded-xl text-sm font-medium border cursor-pointer ${isDark ? "border-[#2E2E2E] text-white" : "border-[#E5E2DE] text-[#232323]"}`}>Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-[#007A53] dark:bg-[#078080] hover:opacity-90 cursor-pointer">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !deleting && setDeleteCat(null)} />
          <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl z-10 p-6 text-center ${isDark ? "bg-[#1E1E1E]" : "bg-white"}`}>
            <p className={`text-sm mb-4 ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Delete <strong>{deleteCat.name}</strong>?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteCat(null)} className={`flex-1 h-10 rounded-xl text-sm font-medium border cursor-pointer ${isDark ? "border-[#2E2E2E] text-white" : "border-[#E5E2DE]"}`}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 h-10 rounded-xl text-sm font-bold text-white bg-[#DA291C] hover:opacity-90 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
