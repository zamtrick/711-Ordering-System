import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, TicketPercent } from "lucide-react";
import api from "@/api/axios";
import { useToast } from "@/hooks/useToast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/ui/Pagination";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type DiscountType = "percent" | "fixed";

type PromoCode = {
  _id: string;
  code: string;
  description?: string;
  type: DiscountType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  maxUses?: number | null;
  usedCount?: number;
  perUserLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  createdAt: string;
};

type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type PromoCodesResponse = {
  promoCodes: PromoCode[];
  pagination?: PaginationMeta;
};

type FormData = {
  code: string;
  description: string;
  type: DiscountType;
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  maxUses: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const defaultForm = (): FormData => ({
  code: "",
  description: "",
  type: "percent",
  value: "",
  minOrderAmount: "",
  maxDiscount: "",
  maxUses: "",
  perUserLimit: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
});

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;

const fetchPromoCodes = ({ page, limit, search }: { page: number; limit: number; search: string }) =>
  api
    .get<PromoCodesResponse>("/superadmin/promo-codes", {
      params: { page, limit, search: search || undefined },
    })
    .then((res) => res.data);

// ISO → value for a <input type="datetime-local"> (local timezone).
const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const formatDiscount = (p: PromoCode) =>
  p.type === "percent" ? `${p.value}% off` : `₱${Number(p.value).toFixed(2)} off`;

// Compact "limits" summary for the table cell.
const formatLimits = (p: PromoCode) => {
  const parts: string[] = [];
  if (Number(p.minOrderAmount) > 0) {
    parts.push(`Min ₱${Number(p.minOrderAmount).toFixed(0)}`);
  }
  const maxUses = p.maxUses ?? Infinity;
  parts.push(`${maxUses === Infinity ? "∞" : (p.usedCount ?? 0) + " / " + maxUses} uses`);
  if (p.perUserLimit) parts.push(`${p.perUserLimit}/user`);
  if (p.type === "percent" && Number(p.maxDiscount) > 0) {
    parts.push(`Max ₱${Number(p.maxDiscount).toFixed(0)}`);
  }
  return parts;
};

// Derived status from active flag + scheduling window.
const statusOf = (p: PromoCode): { label: string; cls: string } => {
  if (!p.isActive) return { label: "Inactive", cls: "bg-sunken text-muted" };
  const now = Date.now();
  if (p.startsAt && new Date(p.startsAt).getTime() > now) {
    return { label: "Scheduled", cls: "bg-warning-soft text-warning" };
  }
  if (p.endsAt && new Date(p.endsAt).getTime() < now) {
    return { label: "Expired", cls: "bg-danger-soft text-danger" };
  }
  return { label: "Active", cls: "bg-accent-soft text-accent-ink" };
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-line">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-sunken" />
        </td>
      ))}
    </tr>
  );
}

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function PromoCodes() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [showForm, setShowForm] = useState(false);
  const [editCode, setEditCode] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [submitting, setSubmitting] = useState(false);

  const [deleteCode, setDeleteCode] = useState<PromoCode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isFetching, error } = useQuery({
    queryKey: ["promo-codes", { page, limit, search: debouncedSearch }],
    queryFn: async () => {
      const res = await fetchPromoCodes({ page, limit, search: debouncedSearch });
      // If the current page ran past the end (e.g. after a delete), step back.
      const max = res.pagination?.totalPages ?? 0;
      if (max > 0 && page > max) {
        return fetchPromoCodes({ page: Math.max(1, max), limit, search: debouncedSearch });
      }
      return res;
    },
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (error) toastError("Failed to load promo codes.");
  }, [error, toastError]);

  const promoCodes = data?.promoCodes ?? [];
  const meta = data?.pagination;
  const loading = isFetching && !data;

  // --------------------------------------------------
  // ACTIONS
  // --------------------------------------------------

  const openCreate = () => {
    setForm(defaultForm());
    setEditCode(null);
    setShowForm(true);
  };

  const openEdit = (p: PromoCode) => {
    setEditCode(p);
    setForm({
      code: p.code,
      description: p.description ?? "",
      type: p.type,
      value: String(p.value ?? ""),
      minOrderAmount: String(p.minOrderAmount ?? ""),
      maxDiscount: String(p.maxDiscount ?? ""),
      maxUses: String(p.maxUses ?? ""),
      perUserLimit: String(p.perUserLimit ?? ""),
      startsAt: toLocalInput(p.startsAt),
      endsAt: toLocalInput(p.endsAt),
      isActive: p.isActive,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditCode(null);
    setForm(defaultForm());
  };

  const validateForm = (): string | null => {
    const code = form.code.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return "Code must be 3–30 characters using letters, numbers, hyphens or underscores.";
    }
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      return "Discount value must be greater than 0.";
    }
    if (form.type === "percent" && value > 100) {
      return "Percentage discount cannot exceed 100.";
    }

    const nonNegative = (raw: string, label: string, allowZero: boolean) => {
      if (!raw) return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) {
        return allowZero
          ? `${label} must be 0 or greater.`
          : `${label} must be greater than 0.`;
      }
      return null;
    };

    const wholePositive = (raw: string, label: string) => {
      if (!raw) return null;
      const n = Number(raw);
      if (!Number.isSafeInteger(n) || n <= 0) {
        return `${label} must be a whole number greater than 0.`;
      }
      return null;
    };

    const minOrder = nonNegative(form.minOrderAmount, "Minimum order amount", true);
    if (minOrder) return minOrder;

    const maxDiscount = nonNegative(form.maxDiscount, "Maximum discount", true);
    if (maxDiscount) return maxDiscount;

    const maxUses = wholePositive(form.maxUses, "Total usage limit");
    if (maxUses) return maxUses;

    const perUser = wholePositive(form.perUserLimit, "Per-customer usage limit");
    if (perUser) return perUser;

    if (form.startsAt && form.endsAt) {
      if (new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()) {
        return "End date must be after the start date.";
      }
    }
    return null;
  };

  const buildPayload = () => ({
    code: form.code.trim().toUpperCase(),
    description: form.description.trim(),
    type: form.type,
    value: Number(form.value),
    minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null,
    maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
    maxUses: form.maxUses ? Number(form.maxUses) : null,
    perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
    isActive: form.isActive,
    ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
  });

  const errorMessage = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    "Failed.";

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toastError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/superadmin/promo-codes", buildPayload());
      success("Promo code created.");
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
    } catch (err: unknown) {
      toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCode) return;
    const validationError = validateForm();
    if (validationError) {
      toastError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/superadmin/promo-codes/${editCode._id}`, buildPayload());
      success("Promo code updated.");
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
    } catch (err: unknown) {
      toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (confirmText?: string) => {
    if (!deleteCode) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/promo-codes/${deleteCode._id}`, {
        data: { confirmText },
      });
      success("Promo code deleted.");
      setDeleteCode(null);
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
    } catch {
      toastError("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  // --------------------------------------------------
  // STYLES
  // --------------------------------------------------

  const inputClass =
    "h-11 px-3 rounded-xl border text-sm outline-none transition-colors w-full bg-surface border-line text-ink focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Promo Codes</h1>
          <p className="text-sm text-muted mt-0.5">
            Discount codes customers can apply at checkout
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 cursor-pointer"
        >
          <Plus size={16} /> Add Code
        </button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="flex items-center h-10 px-3 rounded-xl border bg-surface border-line gap-2">
          <Search size={16} className="text-faint" />
          <input
            placeholder="Search codes..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 h-full outline-none bg-transparent text-sm text-ink placeholder:text-faint"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-surface border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-sunken">
                {["Code", "Discount", "Limits", "Valid Period", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
              ) : promoCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <TicketPercent size={28} className="text-faint" />
                      <p className="font-medium">
                        {search ? "No promo codes match your search." : "No promo codes yet"}
                      </p>
                      {!search && (
                        <p className="text-xs">Create a code customers can redeem at checkout.</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                promoCodes.map((p) => {
                  const status = statusOf(p);
                  return (
                    <tr
                      key={p._id}
                      className={`border-b border-line hover:bg-sunken ${p.isActive ? "" : "opacity-60"}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-ink">{p.code}</span>
                        {p.description ? (
                          <p className="text-xs text-muted max-w-[220px] truncate">{p.description}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{formatDiscount(p)}</td>
                      <td className="px-4 py-3 text-muted">
                        {formatLimits(p).length > 0 ? (
                          <div className="flex flex-col gap-0.5 text-xs">
                            {formatLimits(p).map((line, i) => (
                              <span key={i}>{line}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-faint">Unlimited</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {formatDate(p.startsAt) ?? "Now"}
                        {" → "}
                        {formatDate(p.endsAt) ?? "No expiry"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {formatDate(p.createdAt) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg hover:bg-sunken cursor-pointer"
                            title="Edit code"
                          >
                            <Pencil size={14} className="text-info" />
                          </button>
                          <button
                            onClick={() => setDeleteCode(p)}
                            className="p-1.5 rounded-lg hover:bg-danger-soft cursor-pointer"
                            title="Delete code"
                          >
                            <Trash2 size={14} className="text-danger" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {meta && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
          label="promo codes"
        />
      )}

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !submitting && closeForm()}
          />
          <div className="relative w-full max-w-lg rounded-2xl shadow-2xl z-10 p-6 bg-surface">
            <h3 className="text-lg font-bold text-ink mb-4">
              {editCode ? "Edit Promo Code" : "Add Promo Code"}
            </h3>
            <form onSubmit={editCode ? handleEdit : handleCreate}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-1 block text-muted">Code *</label>
                  <input
                    className={`${inputClass} font-mono uppercase`}
                    placeholder="e.g. SAVE10"
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })
                    }
                    disabled={submitting}
                  />
                  <p className="text-xs text-faint mt-1">
                    Letters, numbers, hyphens and underscores (3–30 characters).
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-1 block text-muted">Description</label>
                  <input
                    className={inputClass}
                    placeholder="Internal note e.g. Summer 2026 campaign"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">Type *</label>
                  <select
                    className={`${inputClass} cursor-pointer`}
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as DiscountType })
                    }
                    disabled={submitting}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed amount (₱)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">
                    Value * {form.type === "percent" ? "(%)" : "(₱)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder={form.type === "percent" ? "e.g. 10" : "e.g. 50"}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    disabled={submitting}
                  />
                </div>

                <div className="col-span-2 mt-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-faint">
                    Limits <span className="font-normal normal-case">(leave blank for no limit)</span>
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">
                    Min Order (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="e.g. 500"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">
                    Max Discount (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="e.g. 100"
                    value={form.maxDiscount}
                    onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">
                    Total Uses
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={inputClass}
                    placeholder="e.g. 500"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    disabled={submitting}
                  />
                  <p className="text-xs text-faint mt-1">Max redemptions overall.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">
                    Uses Per Customer
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={inputClass}
                    placeholder="e.g. 1"
                    value={form.perUserLimit}
                    onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                    disabled={submitting}
                  />
                  <p className="text-xs text-faint mt-1">Max uses per customer.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">Starts At</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    disabled={submitting}
                  />
                  <p className="text-xs text-faint mt-1">Leave empty to start immediately.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted">Ends At</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    disabled={submitting}
                  />
                  <p className="text-xs text-faint mt-1">Leave empty for no expiry.</p>
                </div>

                <div className="col-span-2 flex items-center">
                  <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      disabled={submitting}
                      className="accent-accent"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="px-4 h-10 rounded-xl text-sm font-medium border border-line text-ink cursor-pointer hover:bg-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 cursor-pointer disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteCode !== null}
        onClose={() => !deleting && setDeleteCode(null)}
        onConfirm={handleDelete}
        title="Delete Promo Code"
        confirmText="DELETE"
        message={`Are you sure you want to delete the code "${deleteCode?.code}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
