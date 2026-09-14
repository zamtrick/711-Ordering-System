import { useEffect, useRef, useState } from "react";
import { Search, Eye, Printer } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { printReceipt, type ReceiptOrder } from "@/utils/receipt";
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

type Order = {
  _id: string;
  user: { firstname: string; lastname: string; email: string } | null;
  branch: { name: string; branchCode: string } | null;
  status: string;
  deliveryStatus?: string;
  totalAmount: number;
  deliveryFee?: number;
  deliveryAddress?: string;
  createdAt: string;
  payment?: {
    paymentMethod: string;
    status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  } | null;
  orderItems: { product: { name: string }; quantity: number; unitPrice: number; subTotal: number }[];
  proofOfDelivery?: {
    photoUrl?: string | null;
    scannedAt?: string | null;
  } | null;
};

type OrdersResponse = { orders: Order[]; pagination?: PaginationMeta };

const fetchOrders = ({ page, limit, search, status }: { page: number; limit: number; search: string; status: string }) =>
  api
    .get<OrdersResponse>("/admin/orders", {
      params: {
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
      },
    })
    .then((res) => res.data);

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash on Delivery",
  card: "Card",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

const paymentStatusColor = (s: string) => {
  switch (s) {
    case "paid": return "bg-accent-soft text-accent-ink";
    case "pending": return "bg-warning-soft text-warning";
    case "refunded": return "bg-sunken dark:bg-sunken text-muted";
    default: return "bg-danger-soft text-danger"; // failed / cancelled
  }
};

const socketURL = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

// Customer-facing delivery progress, shown alongside the admin status.
const DELIVERY_LABEL: Record<string, string> = {
  unassigned: "Waiting for rider",
  assigned: "Rider assigned",
  picked_up: "Picked up",
  in_transit: "On the way",
  delivered: "Delivered",
};

// Pipeline stages for the visual progress indicator
const PIPELINE_STAGES = [
  { key: "placed", label: "Placed" },
  { key: "preparing", label: "Preparing" },
  { key: "assigned", label: "Assigned" },
  { key: "picked_up", label: "Picked Up" },
  { key: "in_transit", label: "In Transit" },
  { key: "completed", label: "Completed" },
] as const;

const deliveryColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-accent-soft text-accent-ink";
    case "in_transit": return "bg-info-soft text-info";
    case "picked_up": return "bg-info-soft text-info";
    case "assigned": return "bg-warning-soft text-warning";
    default: return "bg-sunken dark:bg-sunken text-muted";
  }
};

function SkeletonRow() {
  const { isDark } = useTheme();
  return (
    <tr className={`animate-pulse border-b ${isDark ? "border-line" : "border-line"}`}>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className={`h-4 rounded ${isDark ? "bg-sunken" : "bg-sunken"}`} /></td>
      ))}
    </tr>
  );
}

export default function Orders() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [live, setLive] = useState(false);
  const [updating, setUpdating] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Latest list params for the socket handler (avoids re-subscribing the
  // socket on every page/search change while still reading fresh values).
  const listParamsRef = useRef({ page, limit, search: debouncedSearch, status: statusFilter });
  useEffect(() => {
    listParamsRef.current = { page, limit, search: debouncedSearch, status: statusFilter };
  }, [page, limit, debouncedSearch, statusFilter]);

  // Cached per page/limit/search/status — placeholderData keeps the previous
  // page's rows visible while the next page loads instead of collapsing to
  // skeleton.
  const { data, isFetching, error } = useQuery({
    queryKey: ["orders", { page, limit, search: debouncedSearch, status: statusFilter }],
    queryFn: () => fetchOrders({ page, limit, search: debouncedSearch, status: statusFilter }),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (error) toastError("Failed to load orders.");
  }, [error, toastError]);

  const orders = data?.orders ?? [];
  const meta = data?.pagination ?? null;
  const loading = isFetching && !data;

  const NEXT_ACTIONS: Record<string, { status: string; label: string; className: string }[]> = {
    pending: [
      { status: "processing", label: "Accept", className: "bg-accent hover:bg-accent/90 text-white" },
      { status: "cancelled", label: "Cancel", className: "bg-danger-soft text-danger hover:bg-danger-soft" },
    ],
    // Complete is only enabled once rider marks delivered (guarded below + backend).
    // Refund removed — superadmin-only, done in client superadmin Orders.
    processing: [
      { status: "completed", label: "Complete", className: "bg-accent hover:bg-accent/90 text-white" },
      { status: "cancelled", label: "Cancel", className: "bg-danger-soft text-danger hover:bg-danger-soft" },
    ],
    completed: [],
    cancelled: [],
    refunded: [],
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      setUpdating(true);
      const res = await api.patch(`/admin/orders/${orderId}/status`, { status });
      const updated: Order = res.data?.data;
      if (updated?._id) {
        setViewOrder((prev) => (prev?._id === updated._id ? { ...prev, ...updated } : prev));
        toastSuccess(`Order → ${status}`);
        // Refetch the current page so its rows reflect the new status
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    } catch (err: any) {
      toastError(err?.response?.data?.message ?? "Failed to update order.");
    } finally {
      setUpdating(false);
    }
  };

  const handlePrintReceipt = (order: Order) => {
    printReceipt(order as unknown as ReceiptOrder);
  };

  // Live customer → admin updates: new orders, item changes, cancellations.
  // The server emits `order_updated` to admin_room on every mutation.
  useEffect(() => {
    const socket = io(socketURL, {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));

    socket.on("order_updated", (updated: Order) => {
      if (!updated?._id) return;

      // Read-only checks against the cached current page for the toasts.
      const cached = queryClient.getQueryData<OrdersResponse>(["orders", listParamsRef.current]);
      const rows = cached?.orders ?? [];
      const exists = rows.some((o) => o._id === updated._id);

      if (!exists) {
        const name = updated.user ? `${updated.user.firstname} ${updated.user.lastname}` : "Customer";
        toastSuccess(`New order from ${name} — ₱${updated.totalAmount}`);
      } else {
        const prevStatus = rows.find((o) => o._id === updated._id)?.status;
        if (prevStatus && prevStatus !== updated.status) {
          if (updated.status === "cancelled") {
            toastError(`Order #${updated._id.slice(-6).toUpperCase()} cancelled by customer`);
          } else {
            toastSuccess(`Order #${updated._id.slice(-6).toUpperCase()} → ${updated.status}`);
          }
        }
      }

      // New orders can land on any page; status changes shift rows between
      // status-filtered pages. Refetch whatever is cached (active queries).
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      // Keep the open detail modal in sync too
      setViewOrder((prev) => (prev?._id === updated._id ? { ...prev, ...updated } : prev));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Filtering happens server-side (search + status); the API returns the current page.
  const filtered = orders;

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-accent-soft text-accent-ink";
      case "processing": return "bg-info-soft text-info";
      case "pending": return "bg-warning-soft text-warning";
      case "cancelled": return "bg-danger-soft text-danger";
      default: return "bg-sunken dark:bg-sunken text-muted";
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Orders</h1>
          <p className="text-sm text-muted mt-0.5">View and manage customer orders</p>
        </div>
        <span
          className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
            live ? "bg-accent-soft text-accent-ink" : "bg-sunken dark:bg-sunken text-muted"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${live ? "bg-accent" : "bg-faint"}`} />
          {live ? "Live" : "Connecting…"}
        </span>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="max-w-sm flex-1">
          <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
            <Search size={16} className={isDark ? "text-muted" : "text-muted"} />
            <input placeholder="Search by name or ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"}`} />
          </div>
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={`h-10 px-3 rounded-xl border text-sm cursor-pointer ${isDark ? "bg-surface border-line text-white" : "bg-white border-line text-ink"}`}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${isDark ? "bg-sunken border-line" : "bg-sunken border-line"}`}>
            {["Order ID", "Customer", "Branch", "Amount", "Status", "Delivery", "Date", "Details"].map((h) => <th key={h} className={`px-4 py-3 text-left font-semibold ${isDark ? "text-muted" : "text-muted"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
            : filtered.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">No orders found.</td></tr>
            : filtered.map((o) => (
              <tr key={o._id} className={`border-b ${isDark ? "border-line hover:bg-sunken" : "border-line hover:bg-sunken"}`}>
                <td className="px-4 py-3 font-mono text-xs text-muted">{o._id.slice(-8)}</td>
                <td className="px-4 py-3 font-medium text-ink">{o.user ? `${o.user.firstname} ${o.user.lastname}` : "—"}</td>
                <td className="px-4 py-3 text-muted">{o.branch?.name ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-accent-ink">₱{o.totalAmount}</td>
                <td className="px-4 py-3" colSpan={2}>
                  {/* Show delivery status when processing, otherwise show order status */}
                  {o.status === "processing" && o.deliveryStatus && o.deliveryStatus !== "unassigned" ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${deliveryColor(o.deliveryStatus)}`}>
                      {DELIVERY_LABEL[o.deliveryStatus]}
                    </span>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusColor(o.status)}`}>
                      {o.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted text-xs">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3"><button onClick={() => setViewOrder(o)} className="p-1.5 rounded-lg hover:bg-sunken cursor-pointer"><Eye size={14} className="text-info" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setViewOrder(null)} />
          <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-surface" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-ink"}`}>Order Details</h3>
              <div className="flex items-center gap-3">
                {viewOrder.status !== "cancelled" && viewOrder.status !== "refunded" && (
                  <button
                    onClick={() => handlePrintReceipt(viewOrder)}
                    title="Print receipt (hardcopy for the rider pouch)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold cursor-pointer bg-accent hover:bg-accent/90 text-white"
                  >
                    <Printer size={14} />
                    Print Receipt
                  </button>
                )}
                <button onClick={() => setViewOrder(null)} className={`text-sm cursor-pointer ${isDark ? "text-muted" : "text-muted"}`}>Close</button>
              </div>
            </div>
            <div className="space-y-3">
              <div className={`p-3 rounded-xl ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                <p className={`text-xs ${isDark ? "text-muted" : "text-muted"}`}>Customer</p>
                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-ink"}`}>{viewOrder.user?.firstname} {viewOrder.user?.lastname}</p>
                <p className={`text-xs ${isDark ? "text-muted" : "text-muted"}`}>{viewOrder.user?.email}</p>
              </div>
              <div className={`p-3 rounded-xl ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                <p className={`text-xs ${isDark ? "text-muted" : "text-muted"}`}>Branch</p>
                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-ink"}`}>{viewOrder.branch?.name} ({viewOrder.branch?.branchCode})</p>
              </div>
              <div className={`p-3 rounded-xl ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                <p className={`text-xs ${isDark ? "text-muted" : "text-muted"}`}>Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusColor(viewOrder.status)}`}>{viewOrder.status}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${deliveryColor(viewOrder.deliveryStatus ?? "unassigned")}`}>
                    {DELIVERY_LABEL[viewOrder.deliveryStatus ?? "unassigned"]}
                  </span>
                </div>
                {/* Pipeline: Placed → Preparing → Assigned → Picked Up → In Transit → Completed */}
                {viewOrder.status !== "cancelled" && viewOrder.status !== "refunded" && (
                  <div className="flex items-center mt-3">
                    {PIPELINE_STAGES.map((stage, i) => {
                      let reached = false;
                      if (viewOrder.status === "completed") {
                        reached = i <= 5;
                      } else if (viewOrder.status === "processing") {
                        const ds = viewOrder.deliveryStatus;
                        if (ds === "assigned") reached = i <= 2;
                        else if (ds === "picked_up") reached = i <= 3;
                        else if (ds === "in_transit") reached = i <= 4;
                        else if (ds === "delivered") reached = i <= 5;
                        else reached = i <= 1;
                      } else if (viewOrder.status === "pending") {
                        reached = i <= 0;
                      }
                      return (
                        <div key={stage.key} className="flex items-center flex-1">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${reached ? "bg-accent" : isDark ? "bg-sunken" : "bg-line"}`} />
                          {i < PIPELINE_STAGES.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${reached && i < 4 ? "bg-accent" : isDark ? "bg-sunken" : "bg-line"}`} />}
                          <span className={`text-[10px] font-semibold ml-1 whitespace-nowrap ${reached ? "text-accent-ink" : isDark ? "text-muted" : "text-faint"}`}>{stage.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {viewOrder.payment && (
                <div className={`p-3 rounded-xl ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                  <p className={`text-xs ${isDark ? "text-muted" : "text-muted"}`}>Payment</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-sm font-medium ${isDark ? "text-white" : "text-ink"}`}>
                      {PAYMENT_METHOD_LABELS[viewOrder.payment.paymentMethod] ?? viewOrder.payment.paymentMethod}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${paymentStatusColor(viewOrder.payment.status)}`}>
                      {viewOrder.payment.status}
                    </span>
                  </div>
                </div>
              )}
              {viewOrder.orderItems?.length > 0 && (
                <div className={`p-3 rounded-xl ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                  <p className={`text-xs mb-2 ${isDark ? "text-muted" : "text-muted"}`}>Items</p>
                  {viewOrder.orderItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className={isDark ? "text-white" : "text-ink"}>{item.product?.name} × {item.quantity}</span>
                      <span className="font-semibold text-accent-ink">₱{item.subTotal}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={`p-3 rounded-xl flex justify-between ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                <span className={`font-bold ${isDark ? "text-white" : "text-ink"}`}>Total</span>
                <span className="font-bold text-accent-ink">₱{viewOrder.totalAmount}</span>
              </div>

              {/* Proof of Delivery */}
              {viewOrder.proofOfDelivery?.photoUrl && (
                <div className={`p-3 rounded-xl ${isDark ? "bg-sunken" : "bg-sunken"}`}>
                  <p className={`text-xs font-semibold mb-2 ${isDark ? "text-muted" : "text-muted"}`}>Proof of Delivery</p>
                  <img
                    src={viewOrder.proofOfDelivery.photoUrl}
                    alt="Proof of delivery"
                    className="w-full h-48 object-cover rounded-lg mb-2"
                  />
                  {viewOrder.proofOfDelivery?.scannedAt && (
                    <p className={`text-xs ${isDark ? "text-muted" : "text-muted"}`}>
                      Delivered at: {new Date(viewOrder.proofOfDelivery.scannedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Admin actions — only valid transitions for the current status */}
              {(NEXT_ACTIONS[viewOrder.status] ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {(NEXT_ACTIONS[viewOrder.status] ?? []).map((action) => {
                    const needsDelivery =
                      action.status === "completed" && viewOrder.deliveryStatus !== "delivered";
                    return (
                      <button
                        key={action.status}
                        disabled={updating || needsDelivery}
                        title={needsDelivery ? "Waiting for rider to mark delivered" : action.label}
                        onClick={() => handleStatusUpdate(viewOrder._id, action.status)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 ${action.className}`}
                      >
                        {updating ? "Updating…" : action.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {viewOrder.status === "processing" && viewOrder.deliveryStatus !== "delivered" && (
                <p className="text-xs text-warning">
                  Complete unlocks after rider marks delivered (currently: {viewOrder.deliveryStatus ?? "unassigned"}). Refunds are superadmin-only.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && meta && orders.length > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          label="orders"
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
