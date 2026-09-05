import { useEffect, useState } from "react";
import { Search, UserCheck, UserX } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";

type Customer = {
  _id: string;
  user: { _id: string; firstname: string; lastname: string; email: string; isActive: boolean };
  phone: string;
  address: string;
  createdAt: string;
};

export default function Customers() {
  const { isDark } = useTheme();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get("/admin/customers"); setCustomers(res.data?.customers ?? []); } catch { toastError("Failed."); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = customers.filter((c) => `${c.user?.firstname} ${c.user?.lastname} ${c.user?.email}`.toLowerCase().includes(search.toLowerCase()));

  const toggleStatus = async (c: Customer) => {
    try {
      await api.patch(`/admin/customers/${c._id}/status`);
      success("Status toggled.");
      fetchData();
    } catch { toastError("Failed."); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Customers</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">View and manage customers</p>
      </div>

      <div className="mb-4 max-w-sm">
        <div className={`flex items-center h-10 px-3 rounded-xl border gap-2 ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
          <Search size={16} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />
          <input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-[#555]" : "text-[#232323] placeholder:text-[#aaa]"}`} />
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E1E1E] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${isDark ? "bg-[#2A2A2A] border-[#2E2E2E]" : "bg-[#F8F5F2] border-[#E5E2DE]"}`}>
            {["Name", "Email", "Phone", "Status", "Actions"].map((h) => <th key={h} className={`px-4 py-3 text-left font-semibold ${isDark ? "text-[#A0A0A0]" : "text-[#555]"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-[#777]">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-[#777]">No customers found.</td></tr>
            : filtered.map((c) => (
              <tr key={c._id} className={`border-b ${isDark ? "border-[#2E2E2E] hover:bg-[#2A2A2A]" : "border-[#F0F0F0] hover:bg-[#FAFAFA]"}`}>
                <td className="px-4 py-3 font-medium text-[#232323] dark:text-white">{c.user?.firstname} {c.user?.lastname}</td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{c.user?.email}</td>
                <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">{c.phone || "—"}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.user?.isActive ? "bg-[#E8F5EF] dark:bg-[#0A3D3D] text-[#007A53] dark:text-[#4CAF50]" : "bg-[#FFF0F0] dark:bg-[#3D1515] text-[#DA291C]"}`}>{c.user?.isActive ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleStatus(c)} className={`p-1.5 rounded-lg cursor-pointer ${c.user?.isActive ? "hover:bg-[#FFF0F0] dark:hover:bg-[#3D1515]" : "hover:bg-[#E8F5EF] dark:hover:bg-[#0A3D3D]"}`}>
                    {c.user?.isActive ? <UserX size={14} className="text-[#DA291C]" /> : <UserCheck size={14} className="text-[#007A53] dark:text-[#4CAF50]" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
