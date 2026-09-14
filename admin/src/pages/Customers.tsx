import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserCheck, UserX } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import Pagination from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

// Shared paginated-list state (total count + total pages from the API)
type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type Customer = {
  _id: string;
  user: { _id: string; firstname: string; lastname: string; email: string; isActive: boolean };
  phone: string;
  address: string;
  createdAt: string;
};

function SkeletonRow() {
  const { isDark } = useTheme();
  return (
    <tr className={`animate-pulse border-b ${isDark ? "border-line" : "border-line"}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className={`h-4 rounded ${isDark ? "bg-sunken" : "bg-sunken"}`} /></td>
      ))}
    </tr>
  );
}

type CustomersResponse = {
  customers: Customer[];
  pagination?: PaginationMeta;
};

const fetchCustomers = ({ page, limit, search }: { page: number; limit: number; search: string }) =>
  api
    .get<CustomersResponse>("/admin/customers", {
      params: { page, limit, search: search || undefined },
    })
    .then((res) => res.data);

export default function Customers() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Cached per page/limit/search — revisiting the same page serves instantly
  // from cache; placeholderData keeps the previous page's rows visible while
  // the next page loads instead of collapsing to the skeleton.
  const { data, isFetching, error } = useQuery({
    queryKey: ["customers", { page, limit, search: debouncedSearch }],
    queryFn: () => fetchCustomers({ page, limit, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (error) toastError("Failed to load customers.");
  }, [error, toastError]);

  const customers = data?.customers ?? [];
  const meta = data?.pagination ?? null;
  const loading = isFetching && !data;

  const toggleStatus = async (c: Customer) => {
    try {
      await api.patch(`/admin/customers/${c._id}/status`);
      success("Status toggled.");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch { toastError("Failed."); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Customers</h1>
        <p className="text-sm text-muted mt-0.5">View and manage customers</p>
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
          <Search size={16} className={isDark ? "text-muted" : "text-muted"} />
          <input placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"}`} />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${isDark ? "bg-sunken border-line" : "bg-sunken border-line"}`}>
            {["Name", "Email", "Phone", "Status", "Actions"].map((h) => <th key={h} className={`px-4 py-3 text-left font-semibold ${isDark ? "text-muted" : "text-muted"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</>
            : customers.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">No customers found.</td></tr>
            : customers.map((c) => (
              <tr key={c._id} className={`border-b ${isDark ? "border-line hover:bg-sunken" : "border-line hover:bg-sunken"}`}>
                <td className="px-4 py-3 font-medium text-ink">{c.user?.firstname} {c.user?.lastname}</td>
                <td className="px-4 py-3 text-muted">{c.user?.email}</td>
                <td className="px-4 py-3 text-muted">{c.phone || "—"}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.user?.isActive ? "bg-accent-soft text-accent-ink" : "bg-danger-soft text-danger"}`}>{c.user?.isActive ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleStatus(c)} className={`p-1.5 rounded-lg cursor-pointer ${c.user?.isActive ? "hover:bg-danger-soft" : "hover:bg-accent-soft dark:hover:bg-accent-soft"}`}>
                    {c.user?.isActive ? <UserX size={14} className="text-danger" /> : <UserCheck size={14} className="text-accent-ink" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && meta && customers.length > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          label="customers"
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
