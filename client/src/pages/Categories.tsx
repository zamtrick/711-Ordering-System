import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ToastContainer from "@/components/ui/Toast";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/ui/Pagination";

type Category = { _id: string; name: string; description: string; isActive: boolean; createdAt: string };

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F0F0F0]">
      {Array.from({ length: 3 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" />
        </td>
      ))}
    </tr>
  );
}

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
    } catch { toastError("Failed to load categories."); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const pagination = usePagination({ items: filtered, pageSize: 10 });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toastError("Category name is required."); return; }
    setSubmitting(true);
    try {
      await api.post("/admin/categories", { name: name.trim(), description: description.trim() });
      success("Category created successfully.");
      setShowForm(false);
      setName(""); setDescription("");
      fetchData();
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create category."); } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCat) return;
    if (!name.trim()) { toastError("Category name is required."); return; }
    setSubmitting(true);
    try {
      await api.patch(`/admin/categories/${editCat._id}`, { name: name.trim(), description: description.trim() });
      success("Category updated successfully.");
      setEditCat(null);
      setName(""); setDescription("");
      fetchData();
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update category."); } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteCat) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/categories/${deleteCat._id}`);
      success("Category deleted successfully.");
      setDeleteCat(null);
      fetchData();
    } catch { toastError("Failed to delete category."); } finally { setDeleting(false); }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Categories</h1>
          <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">Manage product categories</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setName(""); setDescription(""); setEditCat(null); setShowForm(true); }}>Add Category</Button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={16} />} />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8F5F2] dark:bg-[#2A2A2A] border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
                {["Name", "Description", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]">{search ? "No categories match your search." : "No categories found. Add one to get started."}</td></tr>
              ) : pagination.paginatedItems.map((c) => (
                <tr key={c._id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{c.name}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{c.description || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => { setEditCat(c); setName(c.name); setDescription(c.description); setShowForm(true); }}>Edit</Button>
                      <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteCat(c)}>Delete</Button>
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
      <Modal open={showForm} onClose={() => !submitting && setShowForm(false)} title={editCat ? "Edit Category" : "Add Category"}>
        <form onSubmit={editCat ? handleEdit : handleCreate} noValidate>
          <div className="space-y-4">
            <Input label="Name *" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
            <div>
              <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Description</label>
              <textarea
                className={`w-full h-20 px-3 py-2 rounded-xl border text-sm outline-none resize-none transition-colors ${isDark ? "bg-[#121212] border-[#2E2E2E] text-white placeholder:text-[#555] focus:border-[#078080]" : "bg-white border-[#E5E2DE] text-[#232323] placeholder:text-[#aaa] focus:border-[#007A53]"} focus:ring-2 focus:ring-[#007A53]/20`}
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting}>Save Category</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteCat !== null}
        onClose={() => !deleting && setDeleteCat(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteCat?.name}"? This action cannot be undone.`}
        loading={deleting}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
