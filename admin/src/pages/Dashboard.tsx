import { useState } from "react";
import {
  Package,
  Users,
  Truck,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Store,
  AlertTriangle,
  PieChart,
} from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "@/api/axios";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

// --------------------------------------------------
// TYPES (mirror of /admin/analytics/dashboard)
// --------------------------------------------------

type DashboardData = {
  branch: { _id: string; name: string; branchCode: string } | null;
  overview: {
    totalProducts: number;
    totalCategories: number;
    totalRiders: number;
    totalCustomers: number;
    newCustomersMonth: number;
    totalOrders: number;
  };
  products: {
    total: number;
    lowStock: number;
    categories: number;
    categoryBreakdown: { _id: string; count: number; name: string }[];
    lowStockList: { _id: string; name: string; sku: string; stock: number; categoryId: { name: string } | null }[];
  };
  riders: { total: number; available: number; offline: number; delivering: number };
  customers: { total: number; newThisMonth: number };
  orders: {
    total: number;
    today: number;
    byStatus: { pending: number; processing: number; completed: number; cancelled: number };
    recent: { _id: string; status: string; totalAmount: number; createdAt: string; user: { firstname: string; lastname: string } | null; branch?: { name: string } | null }[];
    overTime: { _id: string; orders: number; revenue: number }[];
  };
  revenue: {
    total: number;
    today: number;
    averageOrderValue: number;
    byPaymentMethod: { _id: string; total: number; count: number }[];
  };
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatNumber = (n: number) => new Intl.NumberFormat("en-PH").format(n);

const formatCompactCurrency = (amount: number) =>
  "₱" +
  new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

// X-axis label: weekday for the 7-day view, month/day for longer ranges.
const trendLabel = (isoDate: string, days: number) =>
  new Date(isoDate).toLocaleDateString("en-PH", days > 7 ? { month: "short", day: "numeric" } : { weekday: "short" });

const statusColor = (status: string): "green" | "blue" | "gray" | "red" | "orange" => {
  switch (status) {
    case "completed": return "green";
    case "processing": return "blue";
    case "pending": return "orange";
    case "cancelled": return "red";
    default: return "gray";
  }
};

function StatCard({ label, value, icon, iconBg, subtitle }: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  subtitle?: string;
}) {
  const { isDark } = useTheme();
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-ink">{value}</p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
        {subtitle && <p className="text-xs text-accent-ink font-medium mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const { isDark } = useTheme();
  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
      <div className="flex items-center gap-2 px-6 py-4 border-b border-line">
        {icon}
        <h3 className="text-sm font-bold text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Placeholder shown while dashboard data loads — mirrors the Card shell + a few pulse rows
function SkeletonCard({ rows = 4 }: { rows?: number }) {
  const { isDark } = useTheme();
  const block = isDark ? "bg-sunken" : "bg-sunken";
  return (
    <div className={`rounded-2xl border overflow-hidden animate-pulse ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
      <div className="px-6 py-4 border-b border-line">
        <div className={`h-4 w-36 rounded ${block}`} />
      </div>
      <div className="px-6 py-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`h-3 w-16 rounded ${block}`} />
            <div className={`flex-1 h-5 rounded-full ${block}`} />
            <div className={`h-3 w-8 rounded ${block}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Trend-chart window: sent to the API as ?days=7|14|30.
  const [days, setDays] = useState(7);

  // Single scoped endpoint — branch admins get their branch's numbers,
  // superadmins get platform-wide ones. TanStack Query handles caching,
  // retries and loading/error state like every other page. 401/403 resolve
  // to null instead of throwing: the interceptor already handles 401, and a
  // 403 (role not permitted) shouldn't flash an error banner.
  const { data = null, isLoading, isError, refetch } = useQuery<DashboardData | null>({
    queryKey: ["dashboard-analytics", days],
    queryFn: async () => {
      try {
        const res = await api.get("/admin/analytics/dashboard", { params: { days } });
        return res.data?.data ?? null;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) return null;
        throw err;
      }
    },
    // Keep showing the previous range while the next one loads — no skeleton
    // flash when switching 7D/14D/30D.
    placeholderData: keepPreviousData,
  });

  const scoped = Boolean(data?.branch);
  const scopeLabel = scoped ? `${data?.branch?.name} (${data?.branch?.branchCode})` : "All branches";

  const cards = data ? [
    {
      label: "Revenue",
      value: formatCurrency(data.revenue.total),
      icon: <DollarSign size={22} className="text-accent" />,
      iconBg: "bg-accent-soft",
      subtitle: `Today: ${formatCurrency(data.revenue.today)}`,
    },
    {
      label: "Orders",
      value: formatNumber(data.orders.total),
      icon: <ShoppingBag size={22} className="text-info" />,
      iconBg: "bg-info-soft",
      subtitle: `Today: ${data.orders.today}`,
    },
    {
      label: "Customers",
      value: formatNumber(data.customers.total),
      icon: <Users size={22} className="text-warning" />,
      iconBg: "bg-warning-soft",
      subtitle: `+${data.customers.newThisMonth} this month`,
    },
    {
      label: "Active Riders",
      value: `${data.riders.available + data.riders.delivering}/${data.riders.total}`,
      icon: <Truck size={22} className="text-accent" />,
      iconBg: "bg-accent-soft",
      subtitle: `${data.riders.delivering} delivering`,
    },
    {
      label: "Products",
      value: formatNumber(data.products.total),
      icon: <Package size={22} className="text-info" />,
      iconBg: "bg-info-soft dark:bg-info-soft",
      subtitle: `${data.products.lowStock} low stock`,
    },
    {
      label: "Avg Order Value",
      value: formatCurrency(data.revenue.averageOrderValue),
      icon: <TrendingUp size={22} className="text-accent-ink" />,
      iconBg: "bg-accent-soft dark:bg-accent-soft",
    },
  ] : [];

  const orderStatusData = data ? [
    { label: "Completed", value: data.orders.byStatus.completed, color: "bg-accent" },
    { label: "Processing", value: data.orders.byStatus.processing, color: "bg-info" },
    { label: "Pending", value: data.orders.byStatus.pending, color: "bg-warning" },
    { label: "Cancelled", value: data.orders.byStatus.cancelled, color: "bg-danger" },
  ] : [];

  const categoryData = data?.products.categoryBreakdown.slice(0, 6) ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-sm text-muted">
            Welcome back, {user?.firstname} — here's your business overview
          </p>
          {data && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              scoped
                ? "bg-accent-soft text-accent-ink"
                : "bg-info-soft text-info"
            }`}>
              <Store size={12} />
              {scopeLabel}
            </span>
          )}
        </div>
      </div>

      {isError && (
        <div className="mb-6 flex items-center gap-4 px-5 py-4 rounded-2xl bg-danger-soft border border-danger/30">
          <p className="text-sm text-danger flex-1">Failed to load dashboard data.</p>
          <Button variant="danger" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`rounded-2xl border p-5 flex items-center gap-4 animate-pulse ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
                <div className={`w-12 h-12 rounded-xl shrink-0 ${isDark ? "bg-sunken" : "bg-sunken"}`} />
                <div className="flex flex-col gap-2">
                  <div className={`h-7 w-16 rounded-lg ${isDark ? "bg-sunken" : "bg-sunken"}`} />
                  <div className={`h-3 w-24 rounded-lg ${isDark ? "bg-sunken" : "bg-sunken"}`} />
                </div>
              </div>
            ))
          : cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Trend charts + range selector */}
      <div className="flex items-center justify-end mb-3">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1 gap-1">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`h-7 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                days === d
                  ? "bg-accent text-white"
                  : "text-muted hover:text-ink dark:hover:text-white"
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {isLoading ? <><SkeletonCard /><SkeletonCard /></> : (
          <>
            {data && (
              <Card title={`Orders (Last ${days} Days)`} icon={<ShoppingBag size={16} className="text-info" />}>
                <div className="p-6 pt-4">
                  <TrendChart
                    data={data.orders.overTime.map((d) => ({ label: trendLabel(d._id, days), value: d.orders }))}
                    color="#4F46E5"
                    isDark={isDark}
                    seriesLabel="Orders"
                    valueFormatter={(v) => formatNumber(v)}
                  />
                </div>
              </Card>
            )}
            {data && (
              <Card title={`Revenue (Last ${days} Days)`} icon={<DollarSign size={16} className="text-accent" />}>
                <div className="p-6 pt-4">
                  <TrendChart
                    data={data.orders.overTime.map((d) => ({ label: trendLabel(d._id, days), value: d.revenue }))}
                    color={isDark ? "#078080" : "#007A53"}
                    isDark={isDark}
                    seriesLabel="Revenue"
                    valueFormatter={(v) => formatCompactCurrency(v)}
                  />
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Status + category row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {isLoading ? <><SkeletonCard /><SkeletonCard /><SkeletonCard /></> : (
          <>
            {data && (
              <Card title="Order Status" icon={<PieChart size={16} className="text-info" />}>
                <div className="px-6 py-4 space-y-2">
                  {orderStatusData.map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${s.color}`} />
                      <span className="text-xs text-muted flex-1">{s.label}</span>
                      <span className="text-xs font-bold text-ink">{s.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {data && (
              <Card title="Products by Category" icon={<Package size={16} className="text-info" />}>
                <div className="px-6 py-4 space-y-2">
                  {categoryData.map((c) => (
                    <div key={c._id} className="flex items-center gap-3">
                      <span className="text-xs text-muted flex-1 truncate">{c.name ?? "Unknown"}</span>
                      <span className="text-xs font-bold text-ink">{c.count}</span>
                    </div>
                  ))}
                  {categoryData.length === 0 && <p className="text-xs text-muted">No categories yet.</p>}
                </div>
              </Card>
            )}
            {data && (
              <Card title="Low Stock" icon={<AlertTriangle size={16} className="text-warning" />}>
                <div className="px-6 py-4 space-y-2">
                  {data.products.lowStockList.map((p) => (
                    <div key={p._id} className="flex items-center gap-3">
                      <span className="text-xs text-muted flex-1 truncate">{p.name}</span>
                      <Badge variant={p.stock <= 2 ? "red" : "orange"}>{p.stock}</Badge>
                    </div>
                  ))}
                  {data.products.lowStockList.length === 0 && (
                    <p className="text-xs text-muted">Nothing low in stock. 👍</p>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Recent orders */}
      {isLoading ? (
        <SkeletonCard rows={5} />
      ) : data && (
        <Card title="Recent Orders" icon={<ShoppingBag size={16} className="text-info" />}>
          {data.orders.recent.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted">No orders yet.</div>
          ) : (
            <div className="divide-y divide-[#F0F0F0] dark:divide-[#2E2E2E]">
              {data.orders.recent.map((o) => (
                <div key={o._id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {o.user ? `${o.user.firstname} ${o.user.lastname}` : "Unknown"}
                    </p>
                    {!scoped && o.branch && (
                      <p className="text-xs text-muted">{o.branch.name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink">{formatCurrency(o.totalAmount)}</p>
                    <Badge variant={statusColor(o.status)}>{o.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// Simple bar chart — shared rendering for orders/revenue trends
function TrendChart({
  data,
  color,
  isDark,
  seriesLabel,
  valueFormatter,
}: {
  data: { label: string; value: number }[];
  color: string;
  isDark: boolean;
  seriesLabel: string;
  valueFormatter: (v: number) => string;
}) {
  const axisColor = isDark ? "#9AA4B0" : "#5C6470";
  const gridColor = isDark ? "#2B3036" : "#ECEEF1";
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis
          tick={{ fontSize: 10, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => valueFormatter(Number(v))}
        />
        <Tooltip
          cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
          contentStyle={{
            backgroundColor: isDark ? "#1C2024" : "#FFFFFF",
            border: `1px solid ${isDark ? "#2B3036" : "#E4E6EA"}`,
            borderRadius: 12,
            fontSize: 12,
            color: isDark ? "#EEF1F4" : "#1A1D21",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
          labelStyle={{ color: axisColor, marginBottom: 4 }}
          formatter={(value) => [valueFormatter(Number(value)), seriesLabel]}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
