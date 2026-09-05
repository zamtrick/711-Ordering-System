import { useEffect, useState, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Plus, Pencil, Trash2, Search, Upload, Download } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
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

type Product = { _id: string; sku: string; barcode: string; name: string; description: string; categoryId: { _id: string; name: string } | string; price: number; stock: number; isActive: boolean; createdAt: string };
type Category = { _id: string; name: string };
type FormData = { sku: string; barcode: string; name: string; description: string; categoryId: string; price: string; stock: string };
const defaultForm = (): FormData => ({ sku: "", barcode: "", name: "", description: "", categoryId: "", price: "", stock: "" });

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F0F0F0]">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" />
        </td>
      ))}
    </tr>
  );
}

export default function Products() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<FormData>(defaultForm());
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get("/admin/products").catch(() => ({ data: { products: [] } })),
        api.get("/admin/categories").catch(() => ({ data: { categories: [] } })),
      ]);
      setProducts(pRes.data?.products ?? []);
      setCategories(cRes.data?.categories ?? []);
    } catch { toastError("Failed to load data."); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  const pagination = usePagination({ items: filtered, pageSize: 10 });

  function validateCreate(f: FormData): Partial<Record<keyof FormData, string>> {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!f.sku.trim()) errs.sku = "SKU is required.";
    if (!f.barcode.trim()) errs.barcode = "Barcode is required.";
    if (!f.name.trim()) errs.name = "Name is required.";
    if (!f.categoryId) errs.categoryId = "Category is required.";
    if (!f.price || Number(f.price) <= 0) errs.price = "Valid price is required.";
    if (!f.stock || Number(f.stock) < 0) errs.stock = "Valid stock is required.";
    return errs;
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateCreate(form);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post("/admin/products", { ...form, price: Number(form.price), stock: Number(form.stock) });
      success("Product created successfully.");
      setShowCreate(false);
      setForm(defaultForm());
      setFormErrors({});
      fetchData();
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create product."); } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    const errs = validateCreate(editForm);
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.patch(`/admin/products/${editProduct._id}`, { ...editForm, price: Number(editForm.price), stock: Number(editForm.stock) });
      success("Product updated successfully.");
      setEditProduct(null);
      setEditErrors({});
      fetchData();
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update product."); } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    try { await api.delete(`/admin/products/${deleteProduct._id}`); success("Product deleted successfully."); setDeleteProduct(null); fetchData(); } catch { toastError("Failed to delete product."); } finally { setDeleting(false); }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({ sku: p.sku, barcode: p.barcode, name: p.name, description: p.description ?? "", categoryId: typeof p.categoryId === "object" ? p.categoryId._id : p.categoryId, price: String(p.price), stock: String(p.stock) });
    setEditErrors({});
  };

  const handleExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/admin/products/import", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const data = res.data?.data;
      success(`Import complete: ${data?.created ?? 0} created, ${data?.skipped ?? 0} skipped`);
      fetchData();
    } catch (err: unknown) { toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Import failed."); } finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const exportTemplate = () => {
    const csv = "sku,barcode,name,description,categoryId,price,stock\nSKU001,1234567890,Sample Product,A sample product,CATEGORY_ID,99,50";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "product_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const ProductForm = ({ f, setF, errs, setErrs, onSubmit }: { f: FormData; setF: (v: FormData) => void; errs: Partial<Record<keyof FormData, string>>; setErrs: (v: Partial<Record<keyof FormData, string>>) => void; onSubmit: (e: FormEvent) => void }) => (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Input label="SKU *" placeholder="SKU" value={f.sku} onChange={(e) => { setF({ ...f, sku: e.target.value }); setErrs({ ...errs, sku: undefined }); }} error={errs.sku} disabled={submitting} />
        <Input label="Barcode *" placeholder="Barcode" value={f.barcode} onChange={(e) => { setF({ ...f, barcode: e.target.value }); setErrs({ ...errs, barcode: undefined }); }} error={errs.barcode} disabled={submitting} />
        <Input label="Name *" placeholder="Product name" value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErrs({ ...errs, name: undefined }); }} error={errs.name} disabled={submitting} />
        <div>
          <Select label="Category *" value={f.categoryId} onChange={(e) => { setF({ ...f, categoryId: e.target.value }); setErrs({ ...errs, categoryId: undefined }); }} disabled={submitting} error={errs.categoryId}>
            <option value="">Select category...</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
        </div>
        <Input label="Price *" type="number" placeholder="0" value={f.price} onChange={(e) => { setF({ ...f, price: e.target.value }); setErrs({ ...errs, price: undefined }); }} error={errs.price} disabled={submitting} />
        <Input label="Stock *" type="number" placeholder="0" value={f.stock} onChange={(e) => { setF({ ...f, stock: e.target.value }); setErrs({ ...errs, stock: undefined }); }} error={errs.stock} disabled={submitting} />
        <div className="col-span-2">
          <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Description</label>
          <textarea
            className={`w-full h-20 px-3 py-2 rounded-xl border text-sm outline-none resize-none transition-colors ${isDark ? "bg-[#121212] border-[#2E2E2E] text-white placeholder:text-[#555] focus:border-[#078080]" : "bg-white border-[#E5E2DE] text-[#232323] placeholder:text-[#aaa] focus:border-[#007A53]"} focus:ring-2 focus:ring-[#007A53]/20`}
            placeholder="Description"
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            disabled={submitting}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setEditProduct(null); }} disabled={submitting}>Cancel</Button>
        <Button type="submit" variant="primary" loading={submitting}>Save Product</Button>
      </div>
    </form>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Products</h1>
          <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Download size={16} />} onClick={exportTemplate}>Template</Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
          <Button variant="primary" icon={<Upload size={16} />} onClick={() => fileInputRef.current?.click()} loading={importing}>{importing ? "Importing..." : "Import Excel"}</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setForm(defaultForm()); setFormErrors({}); setShowCreate(true); }}>Add Product</Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search by name or SKU..." value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} leftIcon={<Search size={16} />} />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8F5F2] dark:bg-[#2A2A2A] border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
                {["Name", "SKU", "Category", "Price", "Stock", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]">No products found.</td></tr>
              ) : pagination.paginatedItems.map((p) => (
                <tr key={p._id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{p.name}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{p.sku}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{typeof p.categoryId === "object" ? p.categoryId.name : "—"}</td>
                  <td className="px-4 py-3 font-semibold text-[#007A53] dark:text-[#4CAF50]">₱{p.price}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.stock <= 5 ? "red" : "green"}>{p.stock}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(p)}>Edit</Button>
                      <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteProduct(p)}>Delete</Button>
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

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => !submitting && setShowCreate(false)} title="Add Product" width="max-w-2xl">
        <ProductForm f={form} setF={setForm} errs={formErrors} setErrs={setFormErrors} onSubmit={handleCreate} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={editProduct !== null} onClose={() => !submitting && setEditProduct(null)} title="Edit Product" width="max-w-2xl">
        <ProductForm f={editForm} setF={setEditForm} errs={editErrors} setErrs={setEditErrors} onSubmit={handleEdit} />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteProduct !== null}
        onClose={() => !deleting && setDeleteProduct(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteProduct?.name}"? This action cannot be undone.`}
        loading={deleting}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
