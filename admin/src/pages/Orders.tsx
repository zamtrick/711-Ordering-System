import { useEffect, useState } from "react";
import { Search, Eye } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";

type Order = {
  _id: string;
  user: { firstname: string; lastname: string; email: string } | null;
  branch: { name: string; branchCode: string } | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  orderItems: { product: { name: string }; quantity: number; unitPrice: number; subTotal: number }[];
};

export default function Orders() {
  const { isDark } = useTheme();
  const { toasts, removeToast, error: toastError } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get("/orders"); setOrders(res.data?.orders ?? []); } catch { toastError("Failed."); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = orders.filter((o) => {
    const name = o.user ? `${o.user.firstname} ${o.user.lastname}`.toLowerCase() : "";
    const matchSearch = name.includes(search.toLowerCase()) || o._id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-[#E8F5EF] dark:bg-[#0A3D3D] text-[#007A53] dark:text-[#4CAF50]";
      case "processing": return "bg-[#EEF2FF] dark:bg-[#1A1A3D] text-[#4F46E5]";
      case "pending": return "bg-[#FFF3E8] dark:bg-[#3D2A15] text-[#FF6720]";
      case "cancelled": return "bg-[#FFF0F0] dark:bg-[#3D1515] text-[#DA291C]";
      default: return "bg-[#F0F0F0] dark:bg-[#2A2A2A] text-[#777] dark:text-[#A0A0A0]";
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Orders</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">View and manage customer orders</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="max-w-sm flex-1">
          <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
            <Search size={16} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />
            <input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-[#555]" : "text-[#232323] placeholder:text-[#aaa]"}`} />
          </div>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`h-10 px-3 rounded-xl border text-sm cursor-pointer ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E] text-white" : "bg-white border-[#E5E2DE] text-[#232323]"}`}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${isDark ? "bg-[#2A2A2A] border-[#2E2E2E]" : "bg-[#F8F5F2] border-[#E5E2DE]"}`}>
            {["Order ID", "Customer", "Branch", "Amount", "Status", "Date", "Details"].map((h) => <th key={h} className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[#777]">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[#777]">No orders found.</td></tr>
            : filtered.map((o) => (
              <tr key={o._id} className={`border-b ${isDark ? "border-[#2E2E2E] hover:bg-[#2A2A2A]" : "border-[#F0F0F0] hover:bg-[#FAFAFA]"}`}>
                <td className="px-4 py-3 font-mono text-xs text-[#555] dark:text-[#A0A0A0]">{o._id.slice(-8)}</td>
                <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{o.user ? `${o.user.firstname} ${o.user.lastname}` : "—"}</td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{o.branch?.name ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-[#007A53] dark:text-[#4CAF50]">₱{o.totalAmount}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusColor(o.status)}`}>{o.status}</span></td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0] text-xs">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3"><button onClick={() => setViewOrder(o)} className="p-1.5 rounded-lg hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] cursor-pointer"><Eye size={14} className="text-[#4F46E5]" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setViewOrder(null)} />
          <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-[#1E1E1E]" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-[#232323]"}`}>Order Details</h3>
              <button onClick={() => setViewOrder(null)} className={`text-sm cursor-pointer ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>Close</button>
            </div>
            <div className="space-y-3">
              <div className={`p-3 rounded-xl ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                <p className={`text-xs ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>Customer</p>
                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-[#232323]"}`}>{viewOrder.user?.firstname} {viewOrder.user?.lastname}</p>
                <p className={`text-xs ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>{viewOrder.user?.email}</p>
              </div>
              <div className={`p-3 rounded-xl ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                <p className={`text-xs ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>Branch</p>
                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-[#232323]"}`}>{viewOrder.branch?.name} ({viewOrder.branch?.branchCode})</p>
              </div>
              <div className={`p-3 rounded-xl ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                <p className={`text-xs ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusColor(viewOrder.status)}`}>{viewOrder.status}</span>
              </div>
              {viewOrder.orderItems?.length > 0 && (
                <div className={`p-3 rounded-xl ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                  <p className={`text-xs mb-2 ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>Items</p>
                  {viewOrder.orderItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className={isDark ? "text-white" : "text-[#232323]"}>{item.product?.name} × {item.quantity}</span>
                      <span className="font-semibold text-[#007A53] dark:text-[#4CAF50]">₱{item.subTotal}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={`p-3 rounded-xl flex justify-between ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"}`}>
                <span className={`font-bold ${isDark ? "text-white" : "text-[#232323]"}`}>Total</span>
                <span className="font-bold text-[#007A53] dark:text-[#4CAF50]">₱{viewOrder.totalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
