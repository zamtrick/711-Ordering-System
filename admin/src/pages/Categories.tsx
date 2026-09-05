import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";

type Category = { _id: string; name: string; description: string; isActive: boolean; createdAt: string };

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
  const [submitting, setSubmitting] = useState(false);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/categories");
      setCategories(res.data?.categories ?? []);
    } catch { toastError("Failed."); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toastError("Name required."); return; }
    setSubmitting(true);
    try { await api.post("/admin/categories", { name: name.trim(), description: description.trim() }); success("Created."); setShowForm(false); setName(""); setDescription(""); fetchData(); } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCat) return;
    setSubmitting(true);
    try { await api.patch(`/admin/categories/${editCat._id}`, { name: name.trim(), description: description.trim() }); success("Updated."); setEditCat(null); fetchData(); } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed."); } finally { setSubmitting(false); }
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
        <button onClick={() => { setName(""); setDescription(""); setEditCat(null); setShowForm(true); }} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-[#007A53] dark:bg-[#078080] hover:opacity-90 cursor-pointer"><Plus size={16} /> Add Category</button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
          <Search size={16} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />
          <input placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-[#555]" : "text-[#232323] placeholder:text-[#aaa]"}`} />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${isDark ? "bg-[#2A2A2A] border-[#2E2E2E]" : "bg-[#F8F5F2] border-[#E5E2DE]"}`}>
            <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Name</th>
            <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Description</th>
            <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="px-4 py-8 text-center text-[#777]">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={3} className="px-4 py-12 text-center text-[#777]">No categories found.</td></tr>
            : filtered.map((c) => (
              <tr key={c._id} className={`border-b ${isDark ? "border-[#2E2E2E] hover:bg-[#2A2A2A]" : "border-[#F0F0F0] hover:bg-[#FAFAFA]"}`}>
                <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{c.name}</td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{c.description || "—"}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1">
                  <button onClick={() => { setEditCat(c); setName(c.name); setDescription(c.description); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] cursor-pointer"><Pencil size={14} className="text-[#4F46E5]" /></button>
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
