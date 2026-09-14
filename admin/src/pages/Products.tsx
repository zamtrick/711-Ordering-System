import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Upload, Download, X, PackageSearch, Store } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useAuth } from "@/context/AuthContext";
import ToastContainer from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type PaginationMeta = {
  total: number; page: number; limit: number;
  totalPages: number; hasNextPage: boolean; hasPrevPage: boolean;
};

type Product = {
  _id: string; sku: string; barcode: string; name: string;
  description: string;
  categoryId: { _id: string; name: string } | string | null;
  price: number; stock: number; isActive: boolean; image?: string; createdAt: string;
  branchStock?: number | null; isAvailableAtBranch?: boolean; configuredAtBranch?: boolean;
};

type Category = { _id: string; name: string };

export type FormData = {
  sku: string; barcode: string; name: string; description: string;
  categoryId: string; price: string; stock: string;
  imageFile: File | null; imagePreview: string; removeImage: boolean;
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

export const defaultForm = (): FormData => ({
  sku: "", barcode: "", name: "", description: "", categoryId: "",
  price: "", stock: "", imageFile: null, imagePreview: "", removeImage: false,
});

const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

export const toAbsolute = (image?: string) =>
  image && !/^https?:\/\//i.test(image) ? `${apiOrigin}${image}` : (image ?? "");

const revokePreview = (url: string) => {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
};

type ProductsResponse = { products: Product[]; pagination?: PaginationMeta };
type CategoriesResponse = { categories: Category[] };

const fetchProducts = ({ page, limit, search }: { page: number; limit: number; search: string }) =>
  api.get<ProductsResponse>("/admin/products", { params: { page, limit, search: search || undefined } })
    .then((r) => r.data);

const fetchCategories = () =>
  api.get<CategoriesResponse>("/admin/categories").then((r) => r.data);

// --------------------------------------------------
// SKELETON ROW
// --------------------------------------------------

function SkeletonRow({ cols = 8 }: { cols?: number }) {
  const { isDark } = useTheme();
  return (
    <tr className="animate-pulse border-b border-line">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-4 rounded ${isDark ? "bg-sunken" : "bg-sunken"}`} />
        </td>
      ))}
    </tr>
  );
}

// --------------------------------------------------
// IMAGE PICKER — top-level component (never remounts on parent re-render)
// --------------------------------------------------

type ImagePickerProps = {
  f: FormData;
  setF: (v: FormData) => void;
  submitting: boolean;
};

function ImagePicker({ f, setF, submitting }: ImagePickerProps) {
  const { isDark } = useTheme();

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    revokePreview(f.imagePreview);
    setF({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file), removeImage: false });
  };

  const clear = () => {
    revokePreview(f.imagePreview);
    setF({ ...f, imageFile: null, imagePreview: "", removeImage: true });
  };

  return (
    <div className="col-span-2">
      <label className="text-xs font-semibold mb-1 block text-muted">Product Image</label>
      <div className={`flex items-center gap-3 p-3 rounded-xl border border-dashed border-line`}>
        {f.imagePreview ? (
          <img src={f.imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-line" />
        ) : (
          <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${isDark ? "bg-sunken" : "bg-sunken"}`}>
            <PackageSearch size={22} className="text-faint" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold cursor-pointer transition-colors ${isDark ? "bg-sunken text-white hover:bg-sunken" : "bg-sunken text-ink hover:bg-line"}`}>
            <Upload size={13} />
            {f.imageFile ? "Change image" : f.imagePreview ? "Replace image" : "Upload image"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden" disabled={submitting} onChange={pick} />
          </label>
          {f.imagePreview ? (
            <button type="button" onClick={clear} disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer text-danger hover:bg-danger-soft">
              <X size={13} /> Remove image
            </button>
          ) : (
            <p className="text-[11px] text-faint">JPG, PNG, WEBP, GIF or AVIF — max 5 MB.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------
// PRODUCT FORM — top-level component (never remounts on parent re-render)
// --------------------------------------------------

type ProductFormProps = {
  f: FormData;
  setF: (v: FormData) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  title: string;
  submitting: boolean;
  categories: Category[];
  isDark: boolean;
};

function ProductForm({ f, setF, onSubmit, onCancel, title, submitting, categories, isDark }: ProductFormProps) {
  const inputClass = `h-11 px-3 rounded-xl border text-sm outline-none transition-colors w-full focus:ring-2 focus:ring-accent/20 ${
    isDark
      ? "bg-surface border-line text-ink placeholder:text-faint focus:border-accent"
      : "bg-white border-line text-ink placeholder:text-faint focus:border-accent"
  }`;
  const selectClass = `h-11 px-3 rounded-xl border text-sm outline-none cursor-pointer transition-colors w-full focus:ring-2 focus:ring-accent/20 ${
    isDark
      ? "bg-surface border-line text-ink focus:border-accent"
      : "bg-white border-line text-ink focus:border-accent"
  }`;

  return (
    <form onSubmit={onSubmit} noValidate>
      <h3 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-ink"}`}>{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block text-muted">SKU *</label>
          <input className={inputClass} placeholder="SKU" value={f.sku}
            onChange={(e) => setF({ ...f, sku: e.target.value })} disabled={submitting} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-muted">Barcode</label>
          <input className={inputClass} placeholder="Barcode" value={f.barcode}
            onChange={(e) => setF({ ...f, barcode: e.target.value })} disabled={submitting} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold mb-1 block text-muted">Name *</label>
          <input className={inputClass} placeholder="Product name" value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })} disabled={submitting} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-muted">Category *</label>
          <select className={selectClass} value={f.categoryId}
            onChange={(e) => setF({ ...f, categoryId: e.target.value })} disabled={submitting}>
            <option value="">Select...</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-muted">Price *</label>
          <input className={inputClass} type="number" placeholder="0" value={f.price}
            onChange={(e) => setF({ ...f, price: e.target.value })} disabled={submitting} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-muted">Stock *</label>
          <input className={inputClass} type="number" placeholder="0" value={f.stock}
            onChange={(e) => setF({ ...f, stock: e.target.value })} disabled={submitting} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold mb-1 block text-muted">Description</label>
          <textarea className={inputClass + " h-20 resize-none"} placeholder="Description" value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })} disabled={submitting} />
        </div>
        <ImagePicker f={f} setF={setF} submitting={submitting} />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onCancel}
          className={`px-4 h-10 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
            isDark ? "border-line text-ink hover:bg-sunken" : "border-line text-ink hover:bg-gray-50"
          }`}>
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 disabled:opacity-60 cursor-pointer">
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

// --------------------------------------------------
// MAIN PAGE
// --------------------------------------------------

export default function Products() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const { can } = useAdminPermissions();
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const readOnly = !isSuperadmin && !can("canManageProducts");

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm());
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<FormData>(defaultForm());

  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isFetching, error } = useQuery({
    queryKey: ["products", { page, limit, search: debouncedSearch }],
    queryFn: () => fetchProducts({ page, limit, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (error) toastError("Failed to load products.");
  }, [error, toastError]);

  const products = data?.products ?? [];
  const meta = data?.pagination ?? null;
  const categories = categoriesData?.categories ?? [];
  const loading = isFetching && !data;

  useEffect(() => {
    if (meta && page > meta.totalPages) setPage(Math.max(1, meta.totalPages));
  }, [meta, page]);

  // ------------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------------

  const uploadImage = async (productId: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    await api.post(`/admin/products/${productId}/image`, fd);
  };

  const closeCreate = () => {
    revokePreview(form.imagePreview);
    setShowCreate(false);
    setForm(defaultForm());
  };

  const closeEdit = () => {
    revokePreview(editForm.imagePreview);
    setEditProduct(null);
    setEditForm(defaultForm());
  };

  // ------------------------------------------------------------------
  // SUBMIT HANDLERS
  // ------------------------------------------------------------------

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.name || !form.categoryId || !form.price || !form.stock) {
      toastError("SKU, name, category, price and stock are required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sku: form.sku, barcode: form.barcode, name: form.name,
        description: form.description, categoryId: form.categoryId,
        price: Number(form.price), stock: Number(form.stock),
      };
      const created = await api.post("/admin/products", payload);
      const productId = created.data?.product?._id as string | undefined;
      if (productId && form.imageFile) await uploadImage(productId, form.imageFile);
      success("Product created.");
      closeCreate();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed.");
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setSubmitting(true);
    try {
      const payload = {
        sku: editForm.sku, barcode: editForm.barcode, name: editForm.name,
        description: editForm.description, categoryId: editForm.categoryId,
        price: Number(editForm.price), stock: Number(editForm.stock),
      };
      await api.patch(`/admin/products/${editProduct._id}`, payload);
      if (editForm.imageFile) {
        await uploadImage(editProduct._id, editForm.imageFile);
      } else if (editForm.removeImage) {
        await api.delete(`/admin/products/${editProduct._id}/image`);
      }
      success("Product updated.");
      closeEdit();
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed.");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (confirmText?: string) => {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/products/${deleteProduct._id}`, { data: { confirmText } });
      success("Product deleted.");
      setDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch { toastError("Failed to delete."); } finally { setDeleting(false); }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({
      sku: p.sku, barcode: p.barcode, name: p.name,
      description: p.description ?? "",
      categoryId: p.categoryId && typeof p.categoryId === "object" ? p.categoryId._id : (p.categoryId ?? ""),
      price: String(p.price), stock: String(p.stock),
      imageFile: null, imagePreview: toAbsolute(p.image), removeImage: false,
    });
  };

  const handleExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/admin/products/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res.data?.data as { created?: number; skipped?: number; errors?: string[] } | undefined;
      const msg = `Import complete: ${d?.created ?? 0} created, ${d?.skipped ?? 0} skipped`;
      if ((d?.errors?.length ?? 0) > 0) {
        const preview = d!.errors!.slice(0, 3).join("\n");
        const more = d!.errors!.length > 3 ? `\n...and ${d!.errors!.length - 3} more` : "";
        toastError(`${msg}\n\n${preview}${more}`);
      } else {
        success(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Import failed.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const csv = "sku,barcode,name,description,categoryId,price,stock\nSKU001,1234567890,Sample Product,A sample product,CATEGORY_ID,99,50";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "product_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------

  const colCount = isSuperadmin ? 7 : 8;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Products</h1>
          <p className="text-sm text-muted mt-0.5">Manage your product catalog</p>
          {readOnly && (
            <p className="text-xs font-semibold text-warning bg-warning-soft px-2.5 py-1 rounded-full inline-block mt-2">
              Read-only — managing products is disabled by superadmin
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold border border-line bg-white dark:bg-surface text-ink hover:bg-sunken cursor-pointer">
            <Download size={16} /> Template
          </button>
          <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
          <button onClick={() => importInputRef.current?.click()} disabled={readOnly || importing}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold border border-line bg-white dark:bg-surface text-ink hover:bg-sunken cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <Upload size={16} />{importing ? "Importing…" : "Import Excel"}
          </button>
          <button onClick={() => { setForm(defaultForm()); setShowCreate(true); }} disabled={readOnly}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
          <Search size={16} className="text-muted" />
          <input placeholder="Search products..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"}`} />
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-sunken">
                {["Image", "Name", "SKU", "Category", "Price", "Stock"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-muted">{h}</th>
                ))}
                {!isSuperadmin && (
                  <th className="px-4 py-3 text-left font-semibold text-muted">
                    <span className="inline-flex items-center gap-1"><Store size={13} /> My branch</span>
                  </th>
                )}
                <th className="px-4 py-3 text-left font-semibold text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
                : products.length === 0
                  ? <tr><td colSpan={colCount} className="px-4 py-12 text-center text-muted">No products found.</td></tr>
                  : products.map((p) => (
                    <tr key={p._id} className="border-b border-line hover:bg-sunken transition-colors">
                      <td className="px-4 py-3">
                        {toAbsolute(p.image) ? (
                          <img src={toAbsolute(p.image)} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-sunken">
                            <PackageSearch size={16} className="text-faint" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                      <td className="px-4 py-3 text-muted">{p.sku}</td>
                      <td className="px-4 py-3 text-muted">
                        {p.categoryId && typeof p.categoryId === "object" ? p.categoryId.name : "—"}
                      </td>
                      <td className="px-4 py-3 text-accent-ink font-semibold">₱{p.price}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.stock <= 5 ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-ink"}`}>
                          {p.stock}
                        </span>
                      </td>
                      {!isSuperadmin && (
                        <td className="px-4 py-3">
                          {!p.configuredAtBranch ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sunken text-muted">Not set</span>
                          ) : !p.isAvailableAtBranch ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-danger-soft text-danger">Unavailable</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent-ink">
                              {p.branchStock ?? p.stock}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} disabled={readOnly} title={readOnly ? "Disabled by superadmin" : "Edit product"} className="p-1.5 rounded-lg hover:bg-sunken cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                            <Pencil size={14} className="text-info" />
                          </button>
                          <button onClick={() => setDeleteProduct(p)} disabled={readOnly} title={readOnly ? "Disabled by superadmin" : "Delete product"} className="p-1.5 rounded-lg hover:bg-danger-soft cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                            <Trash2 size={14} className="text-danger" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && meta && products.length > 0 && (
        <Pagination
          page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={limit}
          onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} label="products"
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeCreate} />
          <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-surface" : "bg-white"}`}>
            <ProductForm
              f={form} setF={setForm} onSubmit={handleCreate} onCancel={closeCreate}
              title="Add Product" submitting={submitting} categories={categories} isDark={isDark}
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeEdit} />
          <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-surface" : "bg-white"}`}>
            <ProductForm
              f={editForm} setF={setEditForm} onSubmit={handleEdit} onCancel={closeEdit}
              title="Edit Product" submitting={submitting} categories={categories} isDark={isDark}
            />
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteProduct !== null}
        onClose={() => !deleting && setDeleteProduct(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        confirmText="DELETE"
        message={`Are you sure you want to delete "${deleteProduct?.name}"? This action cannot be undone.`}
        loading={deleting}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
