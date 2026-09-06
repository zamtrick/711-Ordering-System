import { useEffect, useState } from "react";
import { Search, Eye, Ban } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ToastContainer from "@/components/ui/Toast";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/ui/Pagination";

type Order = {
  _id: string;
  user: { firstname: string; lastname: string; email: string } | null;
  branch: { name: string; branchCode: string } | null;
  status: string;
  totalAmount: number;
  deliveryStatus?: string;
  createdAt: string;
  orderItems: { product: { name: string }; quantity: number; unitPrice: number; subTotal: number }[];
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F0F0F0]">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" /></td>
      ))}
    </tr>
  );
}

function orderStatusVariant(s: string): "green" | "blue" | "orange" | "red" | "gray" {
  switch (s) {
    case "completed": return "green";
    case "processing": return "blue";
    case "pending": return "orange";
    case "cancelled": return "red";
    default: return "gray";
  }
}

export default function Orders() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/orders");
      setOrders(res.data?.orders ?? []);
    } catch { toastError("Failed to load orders."); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const handleCancel = async (o: Order) => {
    setCancellingId(o._id);
    try {
      await api.patch(`/orders/${o._id}/cancel`);
      success("Order cancelled successfully.");
      setViewOrder(null);
      fetchData();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to cancel order.");
    } finally { setCancellingId(null); }
  };

  const filtered = orders.filter((o) => {
    const name = o.user ? `${o.user.firstname} ${o.user.lastname}`.toLowerCase() : "";
    const matchSearch = name.includes(search.toLowerCase()) || o._id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pagination = usePagination({ items: filtered, pageSize: 10 });

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Orders</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">View and manage customer orders</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="max-w-sm flex-1">
          <Input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={16} />} />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`h-11 px-3 rounded-xl border text-sm cursor-pointer outline-none ${isDark ? "bg-[#121212] border-[#2E2E2E] text-white" : "bg-white border-[#E5E2DE] text-[#232323]"}`}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8F5F2] dark:bg-[#2A2A2A] border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
                {["Order ID", "Customer", "Branch", "Amount", "Status", "Date", "Details"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]">No orders found.</td></tr>
              ) : pagination.paginatedItems.map((o) => (
                <tr key={o._id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#555] dark:text-[#A0A0A0]">#{o._id.slice(-6).toUpperCase()}</td>
                  <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{o.user ? `${o.user.firstname} ${o.user.lastname}` : "—"}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{o.branch?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-[#007A53] dark:text-[#4CAF50]">₱{o.totalAmount.toFixed(2)}</td>
                  <td className="px-4 py-3"><Badge variant={orderStatusVariant(o.status)}>{o.status}</Badge></td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0] text-xs">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => setViewOrder(o)}>View</Button>
                      {(o.status === "pending" || o.status === "processing") && (
                        <Button variant="danger" size="sm" icon={<Ban size={14} />} loading={cancellingId === o._id} onClick={() => handleCancel(o)}>Cancel</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-[#E5E2DE] dark:border-[#2E2E2E]">
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setCurrentPage}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
            />
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal open={viewOrder !== null} onClose={() => setViewOrder(null)} title="Order Details" width="max-w-lg">
        {viewOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Customer</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">{viewOrder.user?.firstname} {viewOrder.user?.lastname}</p>
                <p className="text-xs text-[#777] dark:text-[#A0A0A0]">{viewOrder.user?.email}</p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Branch</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">{viewOrder.branch?.name}</p>
                <p className="text-xs text-[#777] dark:text-[#A0A0A0]">{viewOrder.branch?.branchCode}</p>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Status</p>
                <Badge variant={orderStatusVariant(viewOrder.status)}>{viewOrder.status}</Badge>
              </div>
              <div className="bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-1">Total</p>
                <p className="text-lg font-bold text-[#007A53] dark:text-[#4CAF50]">₱{viewOrder.totalAmount.toFixed(2)}</p>
              </div>
            </div>

            {viewOrder.orderItems?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#555] dark:text-[#A0A0A0] mb-2">Items</p>
                <div className="space-y-2">
                  {viewOrder.orderItems.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm bg-[#F8F5F2] dark:bg-[#2A2A2A] rounded-xl px-3 py-2">
                      <div>
                        <span className="font-medium text-[#232323] dark:text-white">{item.product?.name}</span>
                        <span className="text-[#777] dark:text-[#A0A0A0] ml-2">× {item.quantity}</span>
                      </div>
                      <span className="font-semibold text-[#007A53] dark:text-[#4CAF50]">₱{item.subTotal}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(viewOrder.status === "pending" || viewOrder.status === "processing") && (
              <div className="flex justify-end pt-2">
                <Button variant="danger" icon={<Ban size={14} />} loading={cancellingId === viewOrder._id} onClick={() => handleCancel(viewOrder)}>
                  Cancel Order
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
