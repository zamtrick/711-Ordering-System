import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GitBranch,
  Users,
  ShoppingBag,
  TrendingUp,
  Package,
  Truck,
  DollarSign,
  BarChart3,
  PieChart,
} from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

type DashboardData = {
  overview: Record<string, number>;
  branches?: { total: number; active: number; inactive: number; maintenance: number; byStatus: { _id: string; count: number }[] };
  admins?: { total: number; active: number; inactive: number };
  customers: { total: number; newThisMonth: number };
  riders: { total: number; available: number; offline: number; delivering: number };
  products: { total: number; inactive?: number; lowStock: number; categories: number; categoryBreakdown: { _id: string; count: number; name: string }[]; lowStockList: { _id: string; name: string; sku: string; stock: number; categoryId: { name: string } | null }[] };
  orders: { total: number; today: number; thisWeek?: number; thisMonth?: number; byStatus: { pending: number; processing: number; completed: number; cancelled: number; refunded?: number }; recent: { _id: string; status: string; totalAmount: number; createdAt: string; user: { firstname: string; lastname: string } | null; branch: { name: string } | null }[]; overTime: { _id: string; orders: number; revenue: number }[]; topBranches?: { _id: string; name: string; branchCode: string; orderCount: number; totalRevenue: number }[] };
  revenue: { total: number; today: number; thisWeek?: number; thisMonth?: number; averageOrderValue: number; byPaymentMethod: { _id: string; total: number; count: number }[] };
};

function formatCurrency(amount: number): string { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount); }
function formatNumber(n: number): string { return new Intl.NumberFormat("en-PH").format(n); }
function orderStatusColor(status: string): "green" | "blue" | "gray" | "red" | "orange" { switch (status) { case "completed": return "green"; case "processing": return "blue"; case "pending": return "orange"; case "cancelled": return "red"; default: return "gray"; } }

function StatCard({ label, value, icon, iconBg, subtitle }: { label: string; value: number | string; icon: React.ReactNode; iconBg: string; subtitle?: string }) {
  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-[#232323] dark:text-white">{value}</p>
        <p className="text-xs text-[#777] dark:text-[#A0A0A0] mt-0.5">{label}</p>
        {subtitle && <p className="text-xs text-[#007A53] dark:text-[#4CAF50] font-medium mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function VerticalTrendChart({ data, color = "#007A53", height = 60 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t transition-all duration-500" style={{ height: `${Math.max((d.value / max) * (height - 16), d.value > 0 ? 3 : 0)}%`, backgroundColor: color, opacity: 0.8 + (i / data.length) * 0.2 }} />
          {data.length <= 8 && <span className="text-[9px] text-[#777] dark:text-[#A0A0A0]">{d.label}</span>}
        </div>
      ))}
    </div>
  );
}

function HorizontalBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-[#555] dark:text-[#A0A0A0] w-20 shrink-0 text-right truncate">{item.label}</span>
          <div className="flex-1 h-5 bg-[#F0F0F0] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${item.color}`} style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%` }} />
          </div>
          <span className="text-xs font-semibold text-[#232323] dark:text-white w-10 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() { return <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-5 flex items-center gap-4 animate-pulse"><div className="w-12 h-12 rounded-xl bg-[#F0F0F0] dark:bg-[#2A2A2A] shrink-0" /><div className="flex flex-col gap-2"><div className="h-7 w-16 rounded-lg bg-[#F0F0F0] dark:bg-[#2A2A2A]" /><div className="h-3 w-24 rounded-lg bg-[#F0F0F0] dark:bg-[#2A2A2A]" /></div></div>; }
function SkeletonChart() { return <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6 animate-pulse"><div className="h-5 w-32 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A] mb-4" /><div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex items-center gap-3"><div className="h-3 w-16 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" /><div className="flex-1 h-5 rounded-full bg-[#F0F0F0] dark:bg-[#2A2A2A]" /><div className="h-3 w-8 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" /></div>)}</div></div>; }

export default function Dashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const isSuperadmin = user?.role === "superadmin";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const endpoint = isSuperadmin ? "/superadmin/analytics/dashboard" : "/admin/analytics/dashboard";
      const res = await api.get(endpoint);
      setData(res.data?.data ?? null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) { navigate("/login"); return; }
      setFetchError(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const branchStatusData = data?.branches ? [
    { label: "Active", value: data.branches.active, color: "bg-[#007A53] dark:bg-[#078080]" },
    { label: "Inactive", value: data.branches.inactive, color: "bg-[#777] dark:bg-[#A0A0A0]" },
    { label: "Maintenance", value: data.branches.maintenance, color: "bg-[#FF6720]" },
  ] : [];

  const orderStatusData = data ? [
    { label: "Completed", value: data.orders.byStatus.completed, color: "bg-[#007A53] dark:bg-[#078080]" },
    { label: "Processing", value: data.orders.byStatus.processing, color: "bg-[#4F46E5]" },
    { label: "Pending", value: data.orders.byStatus.pending, color: "bg-[#FF6720]" },
    { label: "Cancelled", value: data.orders.byStatus.cancelled, color: "bg-[#DA291C]" },
  ] : [];

  const riderStatusData = data ? [
    { label: "Available", value: data.riders.available, color: "bg-[#007A53] dark:bg-[#078080]" },
    { label: "Delivering", value: data.riders.delivering, color: "bg-[#4F46E5]" },
    { label: "Offline", value: data.riders.offline, color: "bg-[#777] dark:bg-[#A0A0A0]" },
  ] : [];

  const categoryData = data?.products?.categoryBreakdown?.map((c) => ({ label: c.name ?? "Unknown", value: c.count, color: "bg-[#4F46E5]" })) ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Dashboard</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-1">Welcome back, {user?.firstname} — here's your business overview</p>
      </div>

      {fetchError && (
        <div className="mb-6 flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#FFF0F0] dark:bg-[#3D1515] border border-[#DA291C]/30">
          <p className="text-sm text-[#DA291C] flex-1">Failed to load dashboard data.</p>
          <Button variant="danger" size="sm" onClick={fetchDashboard}>Retry</Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></> : data ? (
          <>
            <StatCard label="Total Revenue" value={formatCurrency(data.revenue.total)} icon={<DollarSign size={22} className="text-[#007A53] dark:text-[#078080]" />} iconBg="bg-[#E8F5EF] dark:bg-[#0A3D3D]" subtitle={`Today: ${formatCurrency(data.revenue.today)}`} />
            <StatCard label="Total Orders" value={formatNumber(data.orders.total)} icon={<ShoppingBag size={22} className="text-[#4F46E5]" />} iconBg="bg-[#EEF2FF] dark:bg-[#1A1A3D]" subtitle={`Today: ${data.orders.today}`} />
            <StatCard label="Total Customers" value={formatNumber(data.customers.total)} icon={<Users size={22} className="text-[#FF6720]" />} iconBg="bg-[#FFF3E8] dark:bg-[#3D2A15]" subtitle={`+${data.customers.newThisMonth} this month`} />
            <StatCard label="Total Products" value={formatNumber(data.products.total)} icon={<Package size={22} className="text-[#7C3AED]" />} iconBg="bg-[#F5F3FF] dark:bg-[#2A1A3D]" subtitle={`${data.products.categories} categories`} />
            {isSuperadmin && data.branches && <StatCard label="Active Branches" value={`${data.branches.active}/${data.branches.total}`} icon={<GitBranch size={22} className="text-[#007A53] dark:text-[#078080]" />} iconBg="bg-[#E8F5EF] dark:bg-[#0A3D3D]" />}
            {isSuperadmin && data.admins && <StatCard label="Active Admins" value={`${data.admins.active}/${data.admins.total}`} icon={<Users size={22} className="text-[#4F46E5]" />} iconBg="bg-[#EEF2FF] dark:bg-[#1A1A3D]" />}
            <StatCard label="Active Riders" value={`${data.riders.available + data.riders.delivering}/${data.riders.total}`} icon={<Truck size={22} className="text-[#007A53] dark:text-[#078080]" />} iconBg="bg-[#E8F5EF] dark:bg-[#0A3D3D]" subtitle={`${data.riders.delivering} delivering`} />
            <StatCard label="Avg Order Value" value={formatCurrency(data.revenue.averageOrderValue)} icon={<TrendingUp size={22} className="text-[#059669]" />} iconBg="bg-[#ECFDF5] dark:bg-[#0A2D1D]" />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {loading ? <SkeletonChart /> : data ? (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6">
            <h3 className="text-sm font-bold text-[#232323] dark:text-white mb-4">Revenue (Last 7 Days)</h3>
            <VerticalTrendChart data={data.orders.overTime.map((d) => ({ label: new Date(d._id).toLocaleDateString("en-PH", { weekday: "short" }), value: d.revenue }))} color={isDark ? "#078080" : "#007A53"} height={100} />
          </div>
        ) : null}
        {loading ? <SkeletonChart /> : data ? (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6">
            <h3 className="text-sm font-bold text-[#232323] dark:text-white mb-4">Orders (Last 7 Days)</h3>
            <VerticalTrendChart data={data.orders.overTime.map((d) => ({ label: new Date(d._id).toLocaleDateString("en-PH", { weekday: "short" }), value: d.orders }))} color="#4F46E5" height={100} />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {isSuperadmin && loading ? <SkeletonChart /> : isSuperadmin && data?.branches ? (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6">
            <div className="flex items-center gap-2 mb-4"><BarChart3 size={16} className="text-[#007A53] dark:text-[#078080]" /><h3 className="text-sm font-bold text-[#232323] dark:text-white">Branch Status</h3></div>
            <HorizontalBarChart data={branchStatusData} />
          </div>
        ) : null}
        {loading ? <SkeletonChart /> : data ? (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6">
            <div className="flex items-center gap-2 mb-4"><PieChart size={16} className="text-[#4F46E5]" /><h3 className="text-sm font-bold text-[#232323] dark:text-white">Order Status</h3></div>
            <div className="space-y-2">{orderStatusData.map((s) => <div key={s.label} className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full shrink-0 ${s.color}`} /><span className="text-xs text-[#555] dark:text-[#A0A0A0] flex-1">{s.label}</span><span className="text-xs font-bold text-[#232323] dark:text-white">{s.value}</span></div>)}</div>
          </div>
        ) : null}
        {loading ? <SkeletonChart /> : data ? (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6">
            <div className="flex items-center gap-2 mb-4"><Truck size={16} className="text-[#007A53] dark:text-[#078080]" /><h3 className="text-sm font-bold text-[#232323] dark:text-white">Rider Availability</h3></div>
            <div className="space-y-2">{riderStatusData.map((s) => <div key={s.label} className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full shrink-0 ${s.color}`} /><span className="text-xs text-[#555] dark:text-[#A0A0A0] flex-1">{s.label}</span><span className="text-xs font-bold text-[#232323] dark:text-white">{s.value}</span></div>)}</div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {loading ? <SkeletonChart /> : data ? (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E2DE] dark:border-[#2E2E2E]"><h3 className="text-sm font-bold text-[#232323] dark:text-white">Recent Orders</h3></div>
            {data.orders.recent.length === 0 ? <div className="px-6 py-8 text-center text-sm text-[#777] dark:text-[#A0A0A0]">No orders yet.</div> : (
              <div className="divide-y divide-[#F0F0F0] dark:divide-[#2E2E2E]">{data.orders.recent.map((o) => <div key={o._id} className="flex items-center gap-3 px-6 py-3"><div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#232323] dark:text-white">{o.user ? `${o.user.firstname} ${o.user.lastname}` : "Unknown"}</p><p className="text-xs text-[#777] dark:text-[#A0A0A0]">{o.branch?.name ?? "—"}</p></div><div className="text-right"><p className="text-sm font-bold text-[#232323] dark:text-white">{formatCurrency(o.totalAmount)}</p><Badge variant={orderStatusColor(o.status)}>{o.status}</Badge></div></div>)}</div>
            )}
          </div>
        ) : null}
        {loading ? <SkeletonChart /> : categoryData.length > 0 ? (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6">
            <div className="flex items-center gap-2 mb-4"><Package size={16} className="text-[#4F46E5]" /><h3 className="text-sm font-bold text-[#232323] dark:text-white">Products by Category</h3></div>
            <HorizontalBarChart data={categoryData} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
