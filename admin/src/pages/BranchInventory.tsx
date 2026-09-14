import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Store, PackageSearch, ToggleLeft, ToggleRight, ChevronDown } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
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

type BranchesResponse = { branches: Branch[] };

type BranchInventoryResponse = {
  data: {
    branch: Branch;
    inventory: InventoryRow[];
    pagination?: PaginationMeta;
  };
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
const toAbsolute = (img?: string) =>
  img && !/^https?:\/\//i.test(img) ? `${apiOrigin}${img}` : (img ?? "");

function SkeletonRow() {
  const { isDark } = useTheme();
  return (
    <tr className={`animate-pulse border-b ${isDark ? "border-line" : "border-line"}`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className={`h-4 rounded ${isDark ? "bg-sunken" : "bg-sunken"}`} /></td>
      ))}
    </tr>
  );
}

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function BranchInventory() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Tracks which rows are currently saving (productId → saving bool)
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Inline stock edit state
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});

  // --------------------------------------------------
  // BRANCHES (cached, shared with Riders page)
  // --------------------------------------------------

  const { data: branchesData, error: branchesError } = useQuery({
    queryKey: ["branches"],
    queryFn: () =>
      api
        .get<BranchesResponse>("/admin/branches")
        .then((res) => res.data),
    staleTime: 5 * 60_000,
  });

  const branches = branchesData?.branches ?? [];
  const loadingBranches = !branchesData && !branchesError;

  // Auto-select the first branch once loaded
  useEffect(() => {
    const first = branchesData?.branches?.[0];
    if (!selectedBranch && first) setSelectedBranch(first);
  }, [branchesData, selectedBranch]);

  useEffect(() => {
    if (branchesError) toastError("Failed to load branches.");
  }, [branchesError, toastError]);

  // --------------------------------------------------
  // INVENTORY FOR SELECTED BRANCH (cached per branch/page/search)
  // --------------------------------------------------

  const inventoryKey = [
    "branch-inventory",
    selectedBranch?._id,
    { page, limit, search: debouncedSearch },
  ] as const;

  const { data: inventoryData, isFetching, error: inventoryError } = useQuery({
    queryKey: inventoryKey,
    queryFn: () =>
      api
        .get<BranchInventoryResponse>(`/admin/branch-inventory/${selectedBranch!._id}`, {
          params: { page, limit, search: debouncedSearch || undefined },
        })
        .then((res) => res.data),
    enabled: !!selectedBranch,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (inventoryError) toastError("Failed to load branch inventory.");
  }, [inventoryError, toastError]);

  const inventory = inventoryData?.data.inventory ?? [];
  const meta = inventoryData?.data.pagination ?? null;
  const loadingInventory = isFetching && !inventoryData;

  // Seed the inline stock edit state whenever the page data changes
  useEffect(() => {
    if (!inventoryData) return;
    const stockMap: Record<string, string> = {};
    inventoryData.data.inventory.forEach((r) => {
      stockMap[r.product._id] = r.stock !== null ? String(r.stock) : "";
    });
    setEditingStock(stockMap);
  }, [inventoryData]);

  // Optimistically patch the cached row for this branch/page — no refetch
  // needed for single-row availability/stock edits.
  const patchCachedRow = (pid: string, patch: Partial<InventoryRow>) => {
    if (!selectedBranch) return;
    queryClient.setQueryData<BranchInventoryResponse>(inventoryKey, (old) =>
      old
        ? {
            ...old,
            data: {
              ...old.data,
              inventory: old.data.inventory.map((r) =>
                r.product._id === pid ? { ...r, ...patch } : r,
              ),
            },
          }
        : old,
    );
  };

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
      patchCachedRow(pid, { isAvailable: !row.isAvailable });
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
      patchCachedRow(pid, { stock: stockVal });
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

  // Filtering happens server-side; the API returns the current page.
  const filtered = inventory;

  // "X / Y available" — Y is the branch-wide total from pagination metadata
  // (inventory.length is only the current page).
  const availableCount = inventory.filter((r) => r.isAvailable).length;
  const totalCount = meta?.total ?? inventory.length;

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">
          Branch Inventory
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Control which products are available at each branch and set branch-local stock levels.
        </p>
      </div>

      {/* Branch selector + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Branch dropdown */}
        <div className="relative">
          <Store
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <select
            className={`pl-9 pr-8 h-10 rounded-xl border text-sm font-medium appearance-none cursor-pointer outline-none
              ${isDark
                ? "bg-surface border-line text-white"
                : "bg-white border-line text-ink"
              }`}
            value={selectedBranch?._id ?? ""}
            onChange={(e) => {
              const b = branches.find((b) => b._id === e.target.value);
              if (b) { setSelectedBranch(b); setPage(1); }
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
        </div>

        {/* Search */}
        <div className={`flex items-center gap-2 flex-1 h-10 px-3 rounded-xl border
          ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
          <Search size={15} className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-faint"
          />
        </div>

        {/* Stats pill */}
        {!loadingInventory && selectedBranch && (
          <div className={`flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-semibold shrink-0
            ${isDark ? "bg-accent-soft border-accent-soft text-accent-ink" : "bg-accent-soft border-accent-soft text-accent"}`}>
            {availableCount} / {totalCount} available
          </div>
        )}
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden
        ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b
              ${isDark ? "bg-sunken border-line" : "bg-sunken border-line"}`}>
              {["Product", "Category", "Global Stock", "Branch Stock", "Available", ""].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-left font-semibold
                    ${isDark ? "text-muted" : "text-muted"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingBranches || loadingInventory ? (
              <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted">
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
                        ? "border-line hover:bg-sunken"
                        : "border-line hover:bg-sunken"
                      }
                      ${!row.isAvailable ? "opacity-50" : ""}`}
                  >
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center
                          ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                          {row.product.image ? (
                            <img
                              src={toAbsolute(row.product.image)}
                              alt={row.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <PackageSearch size={18} className="text-muted" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-ink leading-tight">
                            {row.product.name}
                          </p>
                          <p className="text-xs text-muted">
                            {row.product.sku}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-muted text-xs">
                      {row.product.categoryId?.name ?? "—"}
                    </td>

                    {/* Global stock */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${row.product.stock > 0
                          ? isDark ? "bg-accent-soft text-accent-ink" : "bg-accent-soft text-accent"
                          : isDark ? "bg-danger-soft text-danger" : "bg-danger-soft text-danger"
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
                              ? "bg-surface border-line text-ink placeholder:text-faint"
                              : "bg-sunken border-line text-ink placeholder:text-faint"
                            }`}
                        />
                        {isSaving && (
                          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isDark ? "text-muted" : "text-faint"}`}>
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
                          <ToggleRight size={28} className="text-accent-ink" />
                        ) : (
                          <ToggleLeft size={28} className="text-faint dark:text-muted" />
                        )}
                        <span className={`text-xs font-semibold
                          ${row.isAvailable
                            ? "text-accent-ink"
                            : "text-faint dark:text-muted"
                          }`}>
                          {row.isAvailable ? "Available" : "Hidden"}
                        </span>
                      </button>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 font-bold text-accent-ink text-right pr-5">
                      ₱{row.product.price.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loadingInventory && meta && inventory.length > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          label="products"
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
