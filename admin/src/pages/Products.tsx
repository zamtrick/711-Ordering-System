import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Plus, Pencil, Trash2, Search, Upload, X, PackageSearch } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";

type Product = {
  _id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: { _id: string; name: string } | string;
  price: number;
  stock: number;
  isActive: boolean;
  image?: string;
  createdAt: string;
};

type Category = { _id: string; name: string };

type FormData = {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  price: string;
  stock: string;
  imageFile: File | null;
  imagePreview: string; // existing image URL or local object URL of the picked file
  removeImage: boolean;
};

const defaultForm = (): FormData => ({
  sku: "",
  barcode: "",
  name: "",
  description: "",
  categoryId: "",
  price: "",
  stock: "",
  imageFile: null,
  imagePreview: "",
  removeImage: false,
});

// Origin the API runs on (http://localhost:5000 for this admin app).
// Relative image paths returned by the API can be displayed by prefixing this.
const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

const toAbsolute = (image?: string) =>
  image && !/^https?:\/\//i.test(image) ? `${apiOrigin}${image}` : (image ?? "");

const revokePreview = (url: string) => {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
};

export default function Products() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [submitting, setSubmitting] = useState(false);

  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<FormData>(defaultForm());

  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get("/admin/products").catch(() => ({ data: { products: [] } })),
        api.get("/admin/categories").catch(() => ({ data: { categories: [] } })),
      ]);
      setProducts(pRes.data?.products ?? []);
      setCategories(cRes.data?.categories ?? []);
    } catch {
      toastError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  // ------------------------------------------------------------------
  // IMAGE HELPERS
  // ------------------------------------------------------------------

  const uploadImage = async (productId: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    await api.post(`/admin/products/${productId}/image`, fd);
  };

  const pickImage = (e: ChangeEvent<HTMLInputElement>, f: FormData, setF: (v: FormData) => void) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    revokePreview(f.imagePreview);
    setF({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file), removeImage: false });
  };

  const clearPickedImage = (f: FormData, setF: (v: FormData) => void) => {
    revokePreview(f.imagePreview);
    setF({ ...f, imageFile: null, imagePreview: "", removeImage: true });
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
    if (!form.sku || !form.barcode || !form.name || !form.categoryId || !form.price || !form.stock) {
      toastError("All required fields must be filled.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sku: form.sku,
        barcode: form.barcode,
        name: form.name,
        description: form.description,
        categoryId: form.categoryId,
        price: Number(form.price),
        stock: Number(form.stock),
      };
      const created = await api.post("/admin/products", payload);
      const productId = created.data?.product?._id as string | undefined;

      if (productId && form.imageFile) {
        await uploadImage(productId, form.imageFile);
      }

      success("Product created.");
      closeCreate();
      fetchData();
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
        sku: editForm.sku,
        barcode: editForm.barcode,
        name: editForm.name,
        description: editForm.description,
        categoryId: editForm.categoryId,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
      };
      await api.patch(`/admin/products/${editProduct._id}`, payload);

      if (editForm.imageFile) {
        // Uploading a new file replaces the current image (remove flag is moot)
        await uploadImage(editProduct._id, editForm.imageFile);
      } else if (editForm.removeImage) {
        await api.delete(`/admin/products/${editProduct._id}/image`);
      }

      success("Product updated.");
      closeEdit();
      fetchData();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed.");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/products/${deleteProduct._id}`);
      success("Product deleted.");
      setDeleteProduct(null);
      fetchData();
    } catch { toastError("Failed to delete."); } finally { setDeleting(false); }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      description: p.description ?? "",
      categoryId: typeof p.categoryId === "object" ? p.categoryId._id : p.categoryId,
      price: String(p.price),
      stock: String(p.stock),
      imageFile: null,
      imagePreview: toAbsolute(p.image),
      removeImage: false,
    });
  };

  const inputClass = `h-11 px-3 rounded-xl border text-sm outline-none transition-colors ${isDark ? "bg-[#121212] border-[#2E2E2E] text-white placeholder:text-[#555] focus:border-[#078080]" : "bg-white border-[#E5E2DE] text-[#232323] placeholder:text-[#aaa] focus:border-[#007A53]"} focus:ring-2 focus:ring-[#007A53]/20`;
  const selectClass = `h-11 px-3 rounded-xl border text-sm outline-none cursor-pointer transition-colors ${isDark ? "bg-[#121212] border-[#2E2E2E] text-white focus:border-[#078080]" : "bg-white border-[#E5E2DE] text-[#232323] focus:border-[#007A53]"} focus:ring-2 focus:ring-[#007A53]/20`;

  // ------------------------------------------------------------------
  // IMAGE PICKER (used inside add/edit forms)
  // ------------------------------------------------------------------
  const ImagePicker = ({ f, setF }: { f: FormData; setF: (v: FormData) => void }) => (
    <div className="col-span-2">
      <label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Product Image</label>
      <div className={`flex items-center gap-3 p-3 rounded-xl border border-dashed ${isDark ? "border-[#2E2E2E]" : "border-[#E5E2DE]"}`}>
        {f.imagePreview ? (
          <img
            src={f.imagePreview}
            alt="Preview"
            className="w-16 h-16 rounded-lg object-cover border border-[#E5E2DE] dark:border-[#2E2E2E]"
          />
        ) : (
          <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
            <PackageSearch size={22} className="text-[#aaa]" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold cursor-pointer transition-colors ${isDark ? "bg-[#2A2A2A] text-white hover:bg-[#333]" : "bg-[#F0ECE6] text-[#232323] hover:bg-[#E5E2DE]"}`}>
            <Upload size={13} />
            {f.imageFile ? "Change image" : f.imagePreview ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              disabled={submitting}
              onChange={(e) => pickImage(e, f, setF)}
            />
          </label>

          {f.imagePreview && (
            <button
              type="button"
              onClick={() => clearPickedImage(f, setF)}
              disabled={submitting}
              className={`inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer ${isDark ? "text-[#FF6B61] hover:bg-[#3D1515]" : "text-[#DA291C] hover:bg-[#FFF0F0]"}`}
            >
              <X size={13} />
              Remove image
            </button>
          )}

          {!f.imagePreview && (
            <p className={`text-[11px] ${isDark ? "text-[#777]" : "text-[#aaa]"}`}>
              JPG, PNG, WEBP, GIF or AVIF — max 5 MB.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const ProductForm = ({ f, setF, onSubmit, title }: { f: FormData; setF: (v: FormData) => void; onSubmit: (e: FormEvent) => void; title: string }) => (
    <form onSubmit={onSubmit} noValidate>
      <h3 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-[#232323]"}`}>{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>SKU *</label><input className={inputClass + " w-full"} placeholder="SKU" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} disabled={submitting} /></div>
        <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Barcode *</label><input className={inputClass + " w-full"} placeholder="Barcode" value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} disabled={submitting} /></div>
        <div className="col-span-2"><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Name *</label><input className={inputClass + " w-full"} placeholder="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={submitting} /></div>
        <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Category *</label><select className={selectClass + " w-full"} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} disabled={submitting}><option value="">Select...</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Price *</label><input className={inputClass + " w-full"} type="number" placeholder="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} disabled={submitting} /></div>
        <div><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Stock *</label><input className={inputClass + " w-full"} type="number" placeholder="0" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} disabled={submitting} /></div>
        <div className="col-span-2"><label className={`text-xs font-semibold mb-1 block ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Description</label><textarea className={inputClass + " w-full h-20 resize-none"} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} disabled={submitting} /></div>
        <ImagePicker f={f} setF={setF} />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={() => { if (title === "Edit Product") closeEdit(); else closeCreate(); }} className={`px-4 h-10 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${isDark ? "border-[#2E2E2E] text-white hover:bg-[#2A2A2A]" : "border-[#E5E2DE] text-[#232323] hover:bg-gray-50"}`}>Cancel</button>
        <button type="submit" disabled={submitting} className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-[#007A53] dark:bg-[#078080] hover:opacity-90 disabled:opacity-60 cursor-pointer">Save</button>
      </div>
    </form>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Products</h1>
          <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">Manage your product catalog</p>
        </div>
        <button onClick={() => { setForm(defaultForm()); setShowCreate(true); }} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-[#007A53] dark:bg-[#078080] hover:opacity-90 cursor-pointer"><Plus size={16} /> Add Product</button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
          <Search size={16} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />
          <input placeholder="Search products..." value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-[#555]" : "text-[#232323] placeholder:text-[#aaa]"}`} />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={`border-b ${isDark ? "bg-[#2A2A2A] border-[#2E2E2E]" : "bg-[#F8F5F2] border-[#E5E2DE]"}`}>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Image</th>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Name</th>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>SKU</th>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Category</th>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Price</th>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Stock</th>
              <th className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Actions</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[#777] dark:text-[#A0A0A0]">Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]">No products found.</td></tr>
              : filtered.map((p) => (
                <tr key={p._id} className={`border-b transition-colors ${isDark ? "border-[#2E2E2E] hover:bg-[#2A2A2A]" : "border-[#F0F0F0] hover:bg-[#FAFAFA]"}`}>
                  <td className="px-4 py-3">
                    {toAbsolute(p.image) ? (
                      <img src={toAbsolute(p.image)} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                        <PackageSearch size={16} className="text-[#aaa]" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{p.name}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{p.sku}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{typeof p.categoryId === "object" ? p.categoryId.name : "—"}</td>
                  <td className="px-4 py-3 text-[#007A53] dark:text-[#4CAF50] font-semibold">₱{p.price}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.stock <= 5 ? "bg-[#FFF0F0] dark:bg-[#3D1515] text-[#DA291C]" : "bg-[#E8F5EF] dark:bg-[#0A3D3D] text-[#007A53] dark:text-[#4CAF50]"}`}>{p.stock}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] cursor-pointer"><Pencil size={14} className="text-[#4F46E5]" /></button>
                      <button onClick={() => setDeleteProduct(p)} className="p-1.5 rounded-lg hover:bg-[#FFF0F0] dark:hover:bg-[#3D1515] cursor-pointer"><Trash2 size={14} className="text-[#DA291C]" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeCreate} />
          <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-[#1E1E1E]" : "bg-white"}`}>
            <ProductForm f={form} setF={setForm} onSubmit={handleCreate} title="Add Product" />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeEdit} />
          <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-[#1E1E1E]" : "bg-white"}`}>
            <ProductForm f={editForm} setF={setEditForm} onSubmit={handleEdit} title="Edit Product" />
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !deleting && setDeleteProduct(null)} />
          <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl z-10 p-6 text-center ${isDark ? "bg-[#1E1E1E]" : "bg-white"}`}>
            <p className={`text-sm mb-4 ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>Delete <strong>{deleteProduct.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteProduct(null)} disabled={deleting} className={`flex-1 h-10 rounded-xl text-sm font-medium border cursor-pointer ${isDark ? "border-[#2E2E2E] text-white" : "border-[#E5E2DE] text-[#232323]"}`}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 h-10 rounded-xl text-sm font-bold text-white bg-[#DA291C] hover:opacity-90 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
