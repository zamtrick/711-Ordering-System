import { useEffect, useState } from "react";
import { Package, Users, Truck, ShoppingBag, TrendingUp } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

type Stats = {
  products: number;
  categories: number;
  riders: number;
  customers: number;
  orders: number;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [products, categories, riders, customers, orders] = await Promise.all([
        api.get("/admin/products").catch(() => ({ data: { products: [] } })),
        api.get("/admin/categories").catch(() => ({ data: { categories: [] } })),
        api.get("/admin/riders").catch(() => ({ data: { riders: [] } })),
        api.get("/admin/customers").catch(() => ({ data: { customers: [] } })),
        api.get("/orders").catch(() => ({ data: { orders: [] } })),
      ]);
      setStats({
        products: products.data?.products?.length ?? 0,
        categories: categories.data?.categories?.length ?? 0,
        riders: riders.data?.riders?.length ?? 0,
        customers: customers.data?.customers?.length ?? 0,
        orders: orders.data?.orders?.length ?? 0,
      });
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = [
    { label: "Products", value: stats?.products ?? 0, icon: Package, color: "text-[#007A53] dark:text-[#078080]", bg: "bg-[#E8F5EF] dark:bg-[#0A3D3D]" },
    { label: "Categories", value: stats?.categories ?? 0, icon: TrendingUp, color: "text-[#4F46E5]", bg: "bg-[#EEF2FF] dark:bg-[#1A1A3D]" },
    { label: "Riders", value: stats?.riders ?? 0, icon: Truck, color: "text-[#FF6720]", bg: "bg-[#FFF3E8] dark:bg-[#3D2A15]" },
    { label: "Customers", value: stats?.customers ?? 0, icon: Users, color: "text-[#7C3AED]", bg: "bg-[#F5F3FF] dark:bg-[#2A1A3D]" },
    { label: "Orders", value: stats?.orders ?? 0, icon: ShoppingBag, color: "text-[#059669]", bg: "bg-[#ECFDF5] dark:bg-[#0A2D1D]" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Dashboard</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-1">
          Welcome back, {user?.firstname} — manage your branch
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`rounded-2xl border p-5 flex items-center gap-4 animate-pulse ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
                <div className={`w-12 h-12 rounded-xl shrink-0 ${isDark ? "bg-[#2A2A2A]" : "bg-[#F0F0F0]"}`} />
                <div className="flex flex-col gap-2">
                  <div className={`h-7 w-16 rounded-lg ${isDark ? "bg-[#2A2A2A]" : "bg-[#F0F0F0]"}`} />
                  <div className={`h-3 w-24 rounded-lg ${isDark ? "bg-[#2A2A2A]" : "bg-[#F0F0F0]"}`} />
                </div>
              </div>
            ))
          : cards.map((c) => (
              <div key={c.label} className={`rounded-2xl border p-5 flex items-center gap-4 ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
                  <c.icon size={22} className={c.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#232323] dark:text-white">{c.value}</p>
                  <p className="text-xs text-[#777] dark:text-[#A0A0A0]">{c.label}</p>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
