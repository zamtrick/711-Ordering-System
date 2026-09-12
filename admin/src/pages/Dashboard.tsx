import { useEffect, useState } from "react";
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
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
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
    <div className={`rounded-2xl border p-5 flex items-center gap-4 ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-[#232323] dark:text-white">{value}</p>
        <p className="text-xs text-[#777] dark:text-[#A0A0A0] mt-0.5">{label}</p>
        {subtitle && <p className="text-xs text-[#007A53] dark:text-[#4CAF50] font-medium mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const { isDark } = useTheme();
  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
      <div className="flex items-center gap-2 px-6 py-4 border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
        {icon}
        <h3 className="text-sm font-bold text-[#232323] dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      // Single scoped endpoint — branch admins get their branch's numbers,
      // superadmins get platform-wide ones. Replaces the old approach of
      // fetching products/riders/customers/orders lists and counting lengths.
      const res = await api.get("/admin/analytics/dashboard");
      setData(res.data?.data ?? null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return; // axios interceptor handles auth
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scoped = Boolean(data?.branch);
  const scopeLabel = scoped ? `${data?.branch?.name} (${data?.branch?.branchCode})` : "All branches";

  const cards = data ? [
    {
      label: "Revenue",
      value: formatCurrency(data.revenue.total),
      icon: <DollarSign size={22} className="text-[#007A53] dark:text-[#078080]" />,
      iconBg: "bg-[#E8F5EF] dark:bg-[#0A3D3D]",
      subtitle: `Today: ${formatCurrency(data.revenue.today)}`,
    },
    {
      label: "Orders",
      value: formatNumber(data.orders.total),
      icon: <ShoppingBag size={22} className="text-[#4F46E5]" />,
      iconBg: "bg-[#EEF2FF] dark:bg-[#1A1A3D]",
      subtitle: `Today: ${data.orders.today}`,
    },
    {
      label: "Customers",
      value: formatNumber(data.customers.total),
      icon: <Users size={22} className="text-[#FF6720]" />,
      iconBg: "bg-[#FFF3E8] dark:bg-[#3D2A15]",
      subtitle: `+${data.customers.newThisMonth} this month`,
    },
    {
      label: "Active Riders",
      value: `${data.riders.available + data.riders.delivering}/${data.riders.total}`,
      icon: <Truck size={22} className="text-[#007A53] dark:text-[#078080]" />,
      iconBg: "bg-[#E8F5EF] dark:bg-[#0A3D3D]",
      subtitle: `${data.riders.delivering} delivering`,
    },
    {
      label: "Products",
      value: formatNumber(data.products.total),
      icon: <Package size={22} className="text-[#7C3AED]" />,
      iconBg: "bg-[#F5F3FF] dark:bg-[#2A1A3D]",
      subtitle: `${data.products.lowStock} low stock`,
    },
    {
      label: "Avg Order Value",
      value: formatCurrency(data.revenue.averageOrderValue),
      icon: <TrendingUp size={22} className="text-[#059669]" />,
      iconBg: "bg-[#ECFDF5] dark:bg-[#0A2D1D]",
    },
  ] : [];

  const orderStatusData = data ? [
    { label: "Completed", value: data.orders.byStatus.completed, color: "bg-[#007A53] dark:bg-[#078080]" },
    { label: "Processing", value: data.orders.byStatus.processing, color: "bg-[#4F46E5]" },
    { label: "Pending", value: data.orders.byStatus.pending, color: "bg-[#FF6720]" },
    { label: "Cancelled", value: data.orders.byStatus.cancelled, color: "bg-[#DA291C]" },
  ] : [];

  const categoryData = data?.products.categoryBreakdown.slice(0, 6) ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Dashboard</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-sm text-[#777] dark:text-[#A0A0A0]">
            Welcome back, {user?.firstname} — here's your business overview
          </p>
          {data && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              scoped
                ? "bg-[#E8F5EF] dark:bg-[#0A3D3D] text-[#007A53] dark:text-[#4CAF50]"
                : "bg-[#EEF2FF] dark:bg-[#1A1A3D] text-[#4F46E5]"
            }`}>
              <Store size={12} />
              {scopeLabel}
            </span>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="mb-6 flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#FFF0F0] dark:bg-[#3D1515] border border-[#DA291C]/30">
          <p className="text-sm text-[#DA291C] flex-1">Failed to load dashboard data.</p>
          <Button variant="danger" size="sm" onClick={fetchDashboard}>Retry</Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`rounded-2xl border p-5 flex items-center gap-4 animate-pulse ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
                <div className={`w-12 h-12 rounded-xl shrink-0 ${isDark ? "bg-[#2A2A2A]" : "bg-[#F0F0F0]"}`} />
                <div className="flex flex-col gap-2">
                  <div className={`h-7 w-16 rounded-lg ${isDark ? "bg-[#2A2A2A]" : "bg-[#F0F0F0]"}`} />
                  <div className={`h-3 w-24 rounded-lg ${isDark ? "bg-[#2A2A2A]" : "bg-[#F0F0F0]"}`} />
                </div>
              </div>
            ))
          : cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {loading || !data ? null : (
          <Card title="Orders (Last 7 Days)" icon={<ShoppingBag size={16} className="text-[#4F46E5]" />}>
            <div className="p-6 pt-4">
              <TrendBars data={data.orders.overTime.map((d) => ({ label: new Date(d._id).toLocaleDateString("en-PH", { weekday: "short" }), value: d.orders }))} color="#4F46E5" />
            </div>
          </Card>
        )}
        {loading || !data ? null : (
          <Card title="Revenue (Last 7 Days)" icon={<DollarSign size={16} className="text-[#007A53] dark:text-[#078080]" />}>
            <div className="p-6 pt-4">
              <TrendBars data={data.orders.overTime.map((d) => ({ label: new Date(d._id).toLocaleDateString("en-PH", { weekday: "short" }), value: d.revenue }))} color={isDark ? "#078080" : "#007A53"} />
            </div>
          </Card>
        )}
      </div>

      {/* Status + category row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {loading || !data ? null : (
          <Card title="Order Status" icon={<PieChart size={16} className="text-[#4F46E5]" />}>
            <div className="px-6 py-4 space-y-2">
              {orderStatusData.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${s.color}`} />
                  <span className="text-xs text-[#555] dark:text-[#A0A0A0] flex-1">{s.label}</span>
                  <span className="text-xs font-bold text-[#232323] dark:text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {loading || !data ? null : (
          <Card title="Products by Category" icon={<Package size={16} className="text-[#4F46E5]" />}>
            <div className="px-6 py-4 space-y-2">
              {categoryData.map((c) => (
                <div key={c._id} className="flex items-center gap-3">
                  <span className="text-xs text-[#555] dark:text-[#A0A0A0] flex-1 truncate">{c.name ?? "Unknown"}</span>
                  <span className="text-xs font-bold text-[#232323] dark:text-white">{c.count}</span>
                </div>
              ))}
              {categoryData.length === 0 && <p className="text-xs text-[#777] dark:text-[#A0A0A0]">No categories yet.</p>}
            </div>
          </Card>
        )}
        {loading || !data ? null : (
          <Card title="Low Stock" icon={<AlertTriangle size={16} className="text-[#FF6720]" />}>
            <div className="px-6 py-4 space-y-2">
              {data.products.lowStockList.map((p) => (
                <div key={p._id} className="flex items-center gap-3">
                  <span className="text-xs text-[#555] dark:text-[#A0A0A0] flex-1 truncate">{p.name}</span>
                  <Badge variant={p.stock <= 2 ? "red" : "orange"}>{p.stock}</Badge>
                </div>
              ))}
              {data.products.lowStockList.length === 0 && (
                <p className="text-xs text-[#777] dark:text-[#A0A0A0]">Nothing low in stock. 👍</p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Recent orders */}
      {loading || !data ? null : (
        <Card title="Recent Orders" icon={<ShoppingBag size={16} className="text-[#4F46E5]" />}>
          {data.orders.recent.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[#777] dark:text-[#A0A0A0]">No orders yet.</div>
          ) : (
            <div className="divide-y divide-[#F0F0F0] dark:divide-[#2E2E2E]">
              {data.orders.recent.map((o) => (
                <div key={o._id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#232323] dark:text-white">
                      {o.user ? `${o.user.firstname} ${o.user.lastname}` : "Unknown"}
                    </p>
                    {!scoped && o.branch && (
                      <p className="text-xs text-[#777] dark:text-[#A0A0A0]">{o.branch.name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#232323] dark:text-white">{formatCurrency(o.totalAmount)}</p>
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
function TrendBars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height: 100 }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t transition-all duration-500"
            style={{ height: `${Math.max((d.value / max) * 84, d.value > 0 ? 3 : 0)}px`, backgroundColor: color, opacity: 0.8 + (i / data.length) * 0.2 }}
          />
          <span className="text-[9px] text-[#777] dark:text-[#A0A0A0]">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
