import { useEffect, useState } from "react";
import { Search, UserCheck, UserX } from "lucide-react";
import api from "@/api/axios";
import { useToast } from "@/hooks/useToast";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import ToastContainer from "@/components/ui/Toast";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/ui/Pagination";

type Customer = {
  _id: string;
  user: { _id: string; firstname: string; lastname: string; email: string; isActive: boolean };
  phone: string;
  address: string;
  createdAt: string;
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F0F0F0]">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" /></td>
      ))}
    </tr>
  );
}

export default function Customers() {
  const { toasts, removeToast, success, error: toastError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/customers");
      setCustomers(res.data?.customers ?? []);
    } catch { toastError("Failed to load customers."); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = customers.filter((c) => `${c.user?.firstname} ${c.user?.lastname} ${c.user?.email}`.toLowerCase().includes(search.toLowerCase()));

  const pagination = usePagination({ items: filtered, pageSize: 10 });

  const toggleStatus = async (c: Customer) => {
    try {
      await api.patch(`/admin/customers/${c._id}/status`);
      success("Customer status toggled.");
      fetchData();
    } catch { toastError("Failed to toggle status."); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Customers</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">View and manage customers</p>
      </div>

      <div className="mb-4 max-w-sm">
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={16} />} />
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8F5F2] dark:bg-[#2A2A2A] border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
                {["Name", "Email", "Phone", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]">No customers found.</td></tr>
              ) : pagination.paginatedItems.map((c) => (
                <tr key={c._id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{c.user?.firstname} {c.user?.lastname}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{c.user?.email}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{c.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.user?.isActive ? "green" : "red"}>{c.user?.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant={c.user?.isActive ? "danger" : "primary"}
                      size="sm"
                      icon={c.user?.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      onClick={() => toggleStatus(c)}
                    >
                      {c.user?.isActive ? "Deactivate" : "Activate"}
                    </Button>
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
