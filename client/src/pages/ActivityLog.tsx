import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  GitBranch,
  Users,
  LogIn,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "@/api/axios";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditUser = {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
};

type AuditLog = {
  _id: string;
  user: AuditUser;
  action: string;
  target: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function is401(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 401;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActionIcon(action: string) {
  switch (action) {
    case "create_branch":
    case "create_admin":
      return <Activity size={16} className="text-[#007A53]" />;
    case "update_branch":
    case "update_admin":
    case "update_profile":
      return <Settings size={16} className="text-[#4F46E5]" />;
    case "delete_branch":
    case "delete_admin":
      return <Activity size={16} className="text-[#DA291C]" />;
    case "login":
      return <LogIn size={16} className="text-[#007A53]" />;
    case "logout":
      return <LogOut size={16} className="text-[#777] dark:text-[#A0A0A0]" />;
    default:
      return <Activity size={16} className="text-[#777] dark:text-[#A0A0A0]" />;
  }
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create_branch: "Created Branch",
    update_branch: "Updated Branch",
    delete_branch: "Deleted Branch",
    create_admin: "Created Admin",
    update_admin: "Updated Admin",
    delete_admin: "Deleted Admin",
    login: "Logged In",
    logout: "Logged Out",
    update_profile: "Updated Profile",
    toggle_admin_status: "Toggled Admin Status",
  };
  return labels[action] ?? action;
}

function getActionVariant(
  action: string,
): "green" | "red" | "blue" | "gray" {
  if (action.startsWith("create")) return "green";
  if (action.startsWith("delete")) return "red";
  if (action.startsWith("update")) return "blue";
  return "gray";
}

function getTargetIcon(target: string) {
  if (target === "branch") return <GitBranch size={14} />;
  if (target === "admin") return <Users size={14} />;
  return <Activity size={14} />;
}

function getDetailsSummary(
  action: string,
  details: Record<string, unknown> | null,
): string {
  if (!details) return "";
  if (action === "login" || action === "logout") return details.email ? `(${details.email})` : "";
  if (action.includes("branch")) return details.name ? `"${details.name}"` : "";
  if (action.includes("admin")) return details.name ? `"${details.name}"` : "";
  if (action === "update_profile") {
    const parts: string[] = [];
    if (details.firstname) parts.push(`name: ${details.firstname}`);
    if (details.email) parts.push(`email: ${details.email}`);
    if (details.passwordChanged) parts.push("password changed");
    return parts.join(", ");
  }
  return "";
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F0F0F0]">
      {Array.from({ length: 4 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-[#F0F0F0] dark:bg-[#2A2A2A]" />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivityLog() {
  const navigate = useNavigate();
  const { toasts, removeToast, error: toastError } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [actionFilter, setActionFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (actionFilter) params.set("action", actionFilter);
      if (targetFilter) params.set("target", targetFilter);

      const res = await api.get(`/superadmin/audit/logs?${params.toString()}`);
      setLogs(res.data?.logs ?? []);
      setPagination(res.data?.pagination ?? { total: 0, page: 1, limit: 20, pages: 0 });
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      toastError("Failed to load activity logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, targetFilter]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Activity Log</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">
          Track all superadmin actions across the system
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-48">
          <Select
            label="Action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">All Actions</option>
            <option value="create_branch">Create Branch</option>
            <option value="update_branch">Update Branch</option>
            <option value="delete_branch">Delete Branch</option>
            <option value="create_admin">Create Admin</option>
            <option value="update_admin">Update Admin</option>
            <option value="delete_admin">Delete Admin</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="update_profile">Update Profile</option>
          </Select>
        </div>
        <div className="w-48">
          <Select
            label="Target"
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
          >
            <option value="">All Targets</option>
            <option value="branch">Branches</option>
            <option value="admin">Admins</option>
            <option value="auth">Auth</option>
            <option value="profile">Profile</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8F5F2] dark:bg-[#2A2A2A] border-b border-[#E5E2DE] dark:border-[#2E2E2E]">
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Action
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  User
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Details
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#555] dark:text-[#A0A0A0]">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-[#777] dark:text-[#A0A0A0]"
                  >
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log._id}
                    className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] dark:hover:bg-[#2A2A2A] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <Badge variant={getActionVariant(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-[#232323] dark:text-white">
                        {getTargetIcon(log.target)}
                        <span className="font-medium">
                          {log.user?.firstname} {log.user?.lastname}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                      {getDetailsSummary(log.action, log.details)}
                    </td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#A0A0A0]">
                      {formatDate(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#777] dark:text-[#A0A0A0]">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E2DE] dark:border-[#2E2E2E] hover:bg-[#F8F5F2] dark:hover:bg-[#2A2A2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-[#555] dark:text-[#A0A0A0] px-2">
              {pagination.page} / {pagination.pages}
            </span>
            <button
              onClick={() => fetchLogs(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E2DE] dark:border-[#2E2E2E] hover:bg-[#F8F5F2] dark:hover:bg-[#2A2A2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
