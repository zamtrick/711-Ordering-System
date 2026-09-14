import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, LogIn, LogOut, Settings, Shield } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";

type AuditLog = {
  _id: string;
  user?: { _id: string; firstname: string; lastname: string; email: string } | null;
  action: string;
  target: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

type LogsResponse = {
  logs: AuditLog[];
  pagination: { total: number; page: number; limit: number; pages: number };
};

type StatsResponse = {
  success: boolean;
  totalLogs: number;
  todayLogs: number;
  actionCounts: { _id: string; count: number }[];
};

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "login", label: "Logins" },
  { value: "logout", label: "Logouts" },
  { value: "create_branch", label: "Branch Created" },
  { value: "update_branch", label: "Branch Updated" },
  { value: "delete_branch", label: "Branch Deleted" },
  { value: "create_admin", label: "Admin Created" },
  { value: "update_admin", label: "Admin Updated" },
  { value: "delete_admin", label: "Admin Deleted" },
  { value: "update_profile", label: "Profile Updated" },
];

const ACTION_LABELS: Record<string, string> = {
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
  update_delivery_range: "Updated Delivery Range",
};

function actionVariant(action: string): "green" | "red" | "orange" | "gray" | "blue" {
  if (action.startsWith("create")) return "green";
  if (action.startsWith("delete")) return "red";
  if (action.startsWith("update")) return "orange";
  if (action === "login" || action === "logout") return "blue";
  return "gray";
}

function ActionIcon({ action }: { action: string }) {
  const size = 16;
  if (action.startsWith("create")) return <Activity size={size} className="text-accent" />;
  if (action.startsWith("delete")) return <Shield size={size} className="text-danger" />;
  if (action.startsWith("update")) return <Settings size={size} className="text-info" />;
  if (action === "login") return <LogIn size={size} className="text-accent" />;
  if (action === "logout") return <LogOut size={size} className="text-muted" />;
  return <Activity size={size} className="text-muted" />;
}

const formatDateTime = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function detailSummary(log: AuditLog): string {
  if (!log.details) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(log.details)) {
    if (value === null || value === undefined) continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    parts.push(`${label}: ${String(value)}`);
  }
  return parts.join(" · ");
}

function SkeletonRow() {
  const { isDark } = useTheme();
  return (
    <tr className={`animate-pulse border-b ${isDark ? "border-line" : "border-line"}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className={`h-4 rounded ${isDark ? "bg-sunken" : "bg-sunken"}`} /></td>
      ))}
    </tr>
  );
}

export default function ActivityLog() {
  const { isDark } = useTheme();
  const { toasts, removeToast, error: toastError } = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [action, setAction] = useState("");

  const { data, isFetching, error } = useQuery({
    queryKey: ["audit", "logs", { page, limit, action }],
    queryFn: () =>
      api
        .get<LogsResponse>("/superadmin/audit/logs", {
          params: { page, limit, action: action || undefined },
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["audit", "stats"],
    queryFn: () => api.get<StatsResponse>("/superadmin/audit/stats").then((r) => r.data),
  });

  if (error) toastError("Failed to load audit logs.");

  const logs = data?.logs ?? [];
  const pagination = data?.pagination ?? null;
  const loading = isFetching && !data;

  const statCards = [
    { label: "Total Events", value: stats?.totalLogs ?? 0, icon: Activity, tone: "text-accent" },
    { label: "Today", value: stats?.todayLogs ?? 0, icon: LogIn, tone: "text-info" },
    { label: "Action Types", value: stats?.actionCounts?.length ?? 0, icon: Settings, tone: "text-warning" },
    {
      label: "Destructive",
      value:
        stats?.actionCounts
          ?.filter((a) => a._id.startsWith("delete"))
          .reduce((sum, a) => sum + a.count, 0) ?? 0,
      icon: Shield,
      tone: "text-danger",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Activity Log</h1>
        <p className="text-sm text-muted mt-0.5">
          Audit trail of every privileged action across the network
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-white dark:bg-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted">{s.label}</p>
                <p className="text-2xl font-bold text-ink mt-1">{s.value}</p>
              </div>
              <s.icon size={22} className={s.tone} />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="max-w-48">
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDark ? "bg-sunken border-line" : "bg-sunken border-line"}`}>
                {["Action", "User", "Details", "When"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">No activity recorded yet.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className={`border-b ${isDark ? "border-line hover:bg-sunken" : "border-line hover:bg-sunken"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center shrink-0">
                          <ActionIcon action={log.action} />
                        </span>
                        <Badge variant={actionVariant(log.action)}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">
                        {log.user ? `${log.user.firstname} ${log.user.lastname}` : "System"}
                      </p>
                      <p className="text-xs text-muted">{log.user?.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted max-w-md">
                      <span className="line-clamp-2">{detailSummary(log) || `Target: ${log.target}`}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.pages}
          total={pagination.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          label="events"
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
