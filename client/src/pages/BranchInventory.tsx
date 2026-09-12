import { useEffect, useState, useCallback } from "react";
import { Search, Store, PackageSearch, ToggleLeft, ToggleRight, ChevronDown } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Branch = {
  _id: string;
  name: string;
  branchCode: string;
};

type Product = {
  _id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  image?: string;
  categoryId?: { name: string };
};

type InventoryRow = {
  product: Product;
  branchProductId: string | null;
  isAvailable: boolean;
  stock: number | null;
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
const toAbsolute = (img?: string) =>
  img && !/^https?:\/\//i.test(img) ? `${apiOrigin}${img}` : (img ?? "");

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function BranchInventory() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [search, setSearch] = useState("");

  // Tracks which rows are currently saving (productId → saving bool)
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Inline stock edit state
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});

  // --------------------------------------------------
  // FETCH BRANCHES
  // --------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/branches");
        const list: Branch[] = res.data?.branches ?? [];
        setBranches(list);
        if (list.length > 0) setSelectedBranch(list[0]);
      } catch {
        toastError("Failed to load branches.");
      } finally {
        setLoadingBranches(false);
      }
    })();
  }, []);

  // --------------------------------------------------
  // FETCH INVENTORY FOR SELECTED BRANCH
  // --------------------------------------------------

  const fetchInventory = useCallback(async (branchId: string) => {
    setLoadingInventory(true);
    try {
      const res = await api.get(`/admin/branch-inventory/${branchId}`);
      const rows: InventoryRow[] = res.data?.data?.inventory ?? [];
      setInventory(rows);
      // Seed the inline stock edit state
      const stockMap: Record<string, string> = {};
      rows.forEach((r) => {
        stockMap[r.product._id] = r.stock !== null ? String(r.stock) : "";
      });
      setEditingStock(stockMap);
    } catch {
      toastError("Failed to load branch inventory.");
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBranch) fetchInventory(selectedBranch._id);
  }, [selectedBranch, fetchInventory]);

  // --------------------------------------------------
  // TOGGLE AVAILABILITY
  // --------------------------------------------------

  const toggleAvailability = async (row: InventoryRow) => {
    if (!selectedBranch) return;
    const pid = row.product._id;
    setSaving((s) => ({ ...s, [pid]: true }));
    try {
      await api.put(
        `/admin/branch-inventory/${selectedBranch._id}/products/${pid}`,
        {
          isAvailable: !row.isAvailable,
          stock: row.stock,
        },
      );
      setInventory((prev) =>
        prev.map((r) =>
          r.product._id === pid ? { ...r, isAvailable: !r.isAvailable } : r,
        ),
      );
      success(`${row.product.name} ${!row.isAvailable ? "enabled" : "disabled"} for this branch.`);
    } catch {
      toastError("Failed to update availability.");
    } finally {
      setSaving((s) => ({ ...s, [pid]: false }));
    }
  };

  // --------------------------------------------------
  // SAVE STOCK
  // --------------------------------------------------

  const saveStock = async (row: InventoryRow) => {
    if (!selectedBranch) return;
    const pid = row.product._id;
    const raw = editingStock[pid];
    const stockVal = raw === "" ? null : Math.max(0, Math.floor(Number(raw)));

    if (raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
      toastError("Stock must be a non-negative number.");
      return;
    }

    setSaving((s) => ({ ...s, [pid]: true }));
    try {
      await api.put(
        `/admin/branch-inventory/${selectedBranch._id}/products/${pid}`,
        { isAvailable: row.isAvailable, stock: stockVal },
      );
      setInventory((prev) =>
        prev.map((r) => (r.product._id === pid ? { ...r, stock: stockVal } : r)),
      );
      success("Stock updated.");
    } catch {
      toastError("Failed to update stock.");
    } finally {
      setSaving((s) => ({ ...s, [pid]: false }));
    }
  };

  // --------------------------------------------------
  // FILTERED ROWS
  // --------------------------------------------------

  const filtered = inventory.filter((r) =>
    r.product.name.toLowerCase().includes(search.toLowerCase()) ||
    r.product.sku.toLowerCase().includes(search.toLowerCase()) ||
    (r.product.categoryId?.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const availableCount = inventory.filter((r) => r.isAvailable).length;

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">
          Branch Inventory
        </h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">
          Control which products are available at each branch and set branch-local stock levels.
        </p>
      </div>

      {/* Branch selector + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Branch dropdown */}
        <div className="relative">
          <Store
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777] dark:text-[#A0A0A0] pointer-events-none"
          />
          <select
            className={`pl-9 pr-8 h-10 rounded-xl border text-sm font-medium appearance-none cursor-pointer outline-none
              ${isDark
                ? "bg-[#1E1E1E] border-[#2E2E2E] text-white"
                : "bg-white border-[#E5E2DE] text-[#232323]"
              }`}
            value={selectedBranch?._id ?? ""}
            onChange={(e) => {
              const b = branches.find((b) => b._id === e.target.value);
              if (b) setSelectedBranch(b);
            }}
            disabled={loadingBranches}
          >
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name} ({b.branchCode})
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777] pointer-events-none"
          />
        </div>

        {/* Search */}
        <div className={`flex items-center gap-2 flex-1 h-10 px-3 rounded-xl border
          ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
          <Search size={15} className="text-[#777] dark:text-[#A0A0A0] shrink-0" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm text-[#232323] dark:text-white placeholder-[#999]"
          />
        </div>

        {/* Stats pill */}
        {!loadingInventory && selectedBranch && (
          <div className={`flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-semibold shrink-0
            ${isDark ? "bg-[#0A3D3D] border-[#0A3D3D] text-[#4CAF50]" : "bg-[#E8F5EF] border-[#E8F5EF] text-[#007A53]"}`}>
            {availableCount} / {inventory.length} available
          </div>
        )}
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden
        ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b
              ${isDark ? "bg-[#2A2A2A] border-[#2E2E2E]" : "bg-[#F8F5F2] border-[#E5E2DE]"}`}>
              {["Product", "Category", "Global Stock", "Branch Stock", "Available", ""].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-left font-semibold
                    ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingInventory ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#777]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-[#007A53] border-t-transparent rounded-full animate-spin" />
                    Loading inventory…
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center gap-2 text-[#777] dark:text-[#A0A0A0]">
                    <PackageSearch size={36} />
                    <p className="font-medium">No products found</p>
                    {search && (
                      <p className="text-xs">Try a different search term</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const pid = row.product._id;
                const isSaving = saving[pid] ?? false;
                const stockStr = editingStock[pid] ?? "";

                return (
                  <tr
                    key={pid}
                    className={`border-b transition-colors
                      ${isDark
                        ? "border-[#2E2E2E] hover:bg-[#2A2A2A]"
                        : "border-[#F0F0F0] hover:bg-[#FAFAFA]"
                      }
                      ${!row.isAvailable ? "opacity-50" : ""}`}
                  >
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center
                          ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                          {row.product.image ? (
                            <img
                              src={toAbsolute(row.product.image)}
                              alt={row.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <PackageSearch size={18} className="text-[#777]" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-[#232323] dark:text-white leading-tight">
                            {row.product.name}
                          </p>
                          <p className="text-xs text-[#777] dark:text-[#A0A0A0]">
                            {row.product.sku}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0] text-xs">
                      {row.product.categoryId?.name ?? "—"}
                    </td>

                    {/* Global stock */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${row.product.stock > 0
                          ? isDark ? "bg-[#0A3D3D] text-[#4CAF50]" : "bg-[#E8F5EF] text-[#007A53]"
                          : isDark ? "bg-[#3D1515] text-[#FF5C5C]" : "bg-[#FFF0F0] text-[#DA291C]"
                        }`}>
                        {row.product.stock}
                      </span>
                    </td>

                    {/* Branch stock override */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          placeholder="Use global"
                          value={stockStr}
                          onChange={(e) =>
                            setEditingStock((s) => ({ ...s, [pid]: e.target.value }))
                          }
                          onBlur={() => saveStock(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveStock(row);
                          }}
                          disabled={isSaving}
                          className={`w-28 h-8 px-2 rounded-lg border text-sm outline-none
                            ${isDark
                              ? "bg-[#121212] border-[#2E2E2E] text-white placeholder-[#555]"
                              : "bg-[#F8F5F2] border-[#E5E2DE] text-[#232323] placeholder-[#aaa]"
                            }`}
                        />
                        {isSaving && (
                          <div className="w-4 h-4 border-2 border-[#007A53] border-t-transparent rounded-full animate-spin shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#999] mt-0.5">
                        {stockStr === "" ? "inherits global" : "branch override"}
                      </p>
                    </td>

                    {/* Available toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAvailability(row)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title={row.isAvailable ? "Click to disable" : "Click to enable"}
                      >
                        {row.isAvailable ? (
                          <ToggleRight size={28} className="text-[#007A53] dark:text-[#4CAF50]" />
                        ) : (
                          <ToggleLeft size={28} className="text-[#ccc] dark:text-[#555]" />
                        )}
                        <span className={`text-xs font-semibold
                          ${row.isAvailable
                            ? "text-[#007A53] dark:text-[#4CAF50]"
                            : "text-[#999] dark:text-[#555]"
                          }`}>
                          {row.isAvailable ? "Available" : "Hidden"}
                        </span>
                      </button>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 font-bold text-[#007A53] dark:text-[#4CAF50] text-right pr-5">
                      ₱{row.product.price.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
