import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Coins, Plus, Minus, Settings2 } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type Member = {
  _id: string;
  customer: { _id: string; firstname: string; lastname: string; email: string } | null;
  points: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: string;
};

type MembersResponse = {
  data: Member[];
  pagination?: PaginationMeta;
};

type LoyaltySettings = {
  enabled: boolean;
  earnPerPeso: number;
  redeemPoints: number;
  redeemValue: number;
  minRedeemPoints: number;
};

const TIER_STYLES: Record<string, string> = {
  Bronze: "bg-[#FEF3C7] text-[#B45309]",
  Silver: "bg-[#E2E8F0] text-[#475569]",
  Gold: "bg-[#FDE68A] text-[#B45309]",
  Platinum: "bg-[#EDE9FE] text-[#7C3AED]",
};

const fetchMembers = ({
  page,
  limit,
  search,
}: {
  page: number;
  limit: number;
  search: string;
}) =>
  api
    .get<MembersResponse>("/admin/loyalty/members", {
      params: { page, limit, search: search || undefined },
    })
    .then((res) => res.data);

export default function Loyalty() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const isSuperAdmin = user?.role === "superadmin";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Adjust modal state
  const [adjustTarget, setAdjustTarget] = useState<Member | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  // Settings state (superadmin only)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form, setForm] = useState<LoyaltySettings | null>(null);

  const { data, isFetching, error } = useQuery({
    queryKey: ["loyalty-members", { page, limit, search: debouncedSearch }],
    queryFn: () => fetchMembers({ page, limit, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  const settingsQuery = useQuery({
    queryKey: ["loyalty-settings"],
    queryFn: () =>
      api.get<{ data: LoyaltySettings }>("/settings/loyalty").then((r) => r.data.data),
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (error) toastError("Failed to load loyalty members.");
  }, [error, toastError]);

  const members = data?.data ?? [];
  const meta = data?.pagination ?? null;
  const loading = isFetching && !data;

  const adjustMutation = useMutation({
    mutationFn: (payload: { id: string; points: number; reason: string }) =>
      api.post(`/admin/loyalty/members/${payload.id}/adjust`, {
        points: payload.points,
        reason: payload.reason,
      }),
    onSuccess: () => {
      success("Points adjusted.");
      setAdjustTarget(null);
      setAdjustAmount("");
      setAdjustReason("");
      queryClient.invalidateQueries({ queryKey: ["loyalty-members"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to adjust points.";
      toastError(message);
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (payload: LoyaltySettings) => api.put("/settings/loyalty", payload),
    onSuccess: () => {
      success("Loyalty settings saved.");
      setSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["loyalty-settings"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to save settings.";
      toastError(message);
    },
  });

  const submitAdjust = () => {
    if (!adjustTarget) return;
    const points = Math.floor(Number(adjustAmount));
    if (!Number.isFinite(points) || points === 0) {
      toastError("Enter a non-zero whole number.");
      return;
    }
    adjustMutation.mutate({ id: adjustTarget._id, points, reason: adjustReason.trim() });
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Loyalty & Rewards</h1>
          <p className="text-sm text-muted mt-0.5">
            Customer points balances, tiers and manual adjustments
          </p>
        </div>

        {isSuperAdmin && (
          <Button
            variant="secondary"
            onClick={() => {
              setForm(settingsQuery.data ?? null);
              setSettingsOpen(true);
            }}
          >
            <Settings2 size={16} />
            Programme Settings
          </Button>
        )}
      </div>

      <div className="mb-4 max-w-sm">
        <div
          className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${
            isDark ? "bg-surface border-line" : "bg-white border-line"
          }`}
        >
          <Search size={16} className="text-muted" />
          <input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`flex-1 h-full outline-none bg-transparent text-sm ${
              isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"
            }`}
          />
        </div>
      </div>

      <div
        className={`rounded-2xl border overflow-hidden ${
          isDark ? "bg-surface border-line" : "bg-white border-line"
        }`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-sunken border-line">
              {["Customer", "Email", "Points", "Tier", "Lifetime", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-line">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-sunken" />
                    </td>
                  ))}
                </tr>
              ))
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  No loyalty members yet.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m._id}
                  className="border-b border-line hover:bg-sunken transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {m.customer
                      ? `${m.customer.firstname} ${m.customer.lastname}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{m.customer?.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-accent-ink">
                      <Coins size={14} />
                      {m.points}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        TIER_STYLES[m.tier] ?? "bg-sunken text-muted"
                      }`}
                    >
                      {m.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {m.lifetimeEarned} earned · {m.lifetimeRedeemed} redeemed
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setAdjustTarget(m);
                        setAdjustAmount("");
                        setAdjustReason("");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-soft text-accent-ink hover:opacity-80 cursor-pointer"
                    >
                      <Plus size={13} />
                      Adjust
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && meta && members.length > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          label="members"
        />
      )}

      {/* ADJUST MODAL */}
      <Modal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        title="Adjust Points"
      >
        {adjustTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-sunken p-3">
              <p className="text-sm font-semibold text-ink">
                {adjustTarget.customer
                  ? `${adjustTarget.customer.firstname} ${adjustTarget.customer.lastname}`
                  : "Customer"}
              </p>
              <p className="text-xs text-muted mt-0.5">
                Current balance: {adjustTarget.points} points
              </p>
            </div>

            <Input
              label="Points (use negative to deduct)"
              type="number"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="e.g. 100 or -50"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustAmount("50")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-soft text-accent-ink cursor-pointer"
              >
                <Plus size={13} /> 50
              </button>
              <button
                type="button"
                onClick={() => setAdjustAmount("-50")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-danger-soft text-danger cursor-pointer"
              >
                <Minus size={13} /> 50
              </button>
            </div>

            <Input
              label="Reason (optional)"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g. Goodwill credit"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAdjustTarget(null)}>
                Cancel
              </Button>
              <Button onClick={submitAdjust} disabled={adjustMutation.isPending}>
                {adjustMutation.isPending ? "Saving..." : "Apply Adjustment"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* SETTINGS MODAL */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Loyalty Programme Settings"
      >
        {form && (
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Programme enabled</span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="w-5 h-5 accent-[#007A53] cursor-pointer"
              />
            </label>

            <Input
              label="Points earned per ₱1 spent"
              type="number"
              step="0.01"
              value={String(form.earnPerPeso)}
              onChange={(e) => setForm({ ...form, earnPerPeso: Number(e.target.value) })}
            />

            <Input
              label="Points required per redemption"
              type="number"
              value={String(form.redeemPoints)}
              onChange={(e) => setForm({ ...form, redeemPoints: Number(e.target.value) })}
            />

            <Input
              label="Discount value of one redemption (₱)"
              type="number"
              value={String(form.redeemValue)}
              onChange={(e) => setForm({ ...form, redeemValue: Number(e.target.value) })}
            />

            <Input
              label="Minimum points per redemption"
              type="number"
              value={String(form.minRedeemPoints)}
              onChange={(e) => setForm({ ...form, minRedeemPoints: Number(e.target.value) })}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => settingsMutation.mutate(form)}
                disabled={settingsMutation.isPending}
              >
                {settingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
