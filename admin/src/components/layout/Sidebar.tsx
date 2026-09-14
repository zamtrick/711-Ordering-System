import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  Users,
  ShoppingBag,
  LogOut,
  Store,
  Sun,
  Moon,
  MapPin,
  Boxes,
  MessageCircle,
  Shield,
  UserCircle,
  Megaphone,
  MonitorPlay,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useState, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import api from "@/api/axios";

// --------------------------------------------------
// Nav config
// --------------------------------------------------

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  badge?: "chat" | "orders";
};

type NavSection = {
  heading?: string;
  items: NavItem[];
};

const superadminNav: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { to: "/products",   label: "Products",   icon: Package },
      { to: "/categories", label: "Categories", icon: Tags },
      { to: "/promos",     label: "Promos",     icon: Megaphone },
      { to: "/app-open-ads", label: "App Open Ad", icon: MonitorPlay },
    ],
  },
  {
    heading: "Network",
    items: [
      { to: "/branches", label: "Branches", icon: MapPin },
      { to: "/admins", label: "Admins", icon: Shield },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/orders", label: "Orders",  icon: ShoppingBag, badge: "orders" },
      { to: "/riders", label: "Riders",  icon: Truck },
      { to: "/chat",   label: "Chat",    icon: MessageCircle, badge: "chat" },
    ],
  },
  {
    heading: "System",
    items: [
      { to: "/settings",      label: "Settings",     icon: SettingsIcon },
      { to: "/activity-log", label: "Activity Log", icon: ScrollText },
    ],
  },
];

const adminNav: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    heading: "My Branch",
    items: [
      { to: "/branch-inventory", label: "Inventory",  icon: Boxes },
      { to: "/products",         label: "Products",   icon: Package },
      { to: "/categories",       label: "Categories", icon: Tags },
      { to: "/riders",           label: "Riders",     icon: Truck },
      { to: "/customers",        label: "Customers",  icon: Users },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/orders", label: "Orders", icon: ShoppingBag, badge: "orders" },
      { to: "/chat",   label: "Chat",   icon: MessageCircle, badge: "chat" },
    ],
  },
  {
    heading: "Account",
    items: [
      { to: "/settings", label: "Settings",    icon: SettingsIcon },
      { to: "/profile",  label: "My Profile", icon: UserCircle },
    ],
  },
];

// Optional nav entries shown only when the superadmin's permission toggle
// is ON for this branch admin (App Open Ads management).
const adminNavExtras: { to: string; label: string; icon: React.ElementType; perm: "canManageAds" }[] = [
  { to: "/app-open-ads", label: "App Open Ad", icon: MonitorPlay, perm: "canManageAds" },
];

const socketURL = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { perms } = useAdminPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = user?.role === "superadmin";

  // Branch admins get the App Open Ad entry only when the superadmin's
  // "Manage App Open Ads" toggle is ON for their account.
  const sections: NavSection[] = isSuperAdmin
    ? superadminNav
    : adminNav.map((section, idx) =>
        idx === 1
          ? {
              ...section,
              items: [
                ...section.items,
                ...adminNavExtras
                  .filter((e) => perms[e.perm])
                  .map(({ to, label, icon }) => ({ to, label, icon, badge: undefined })),
              ],
            }
          : section,
      );

  const [unreadChat, setUnreadChat]       = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const refreshPendingOrders = () => {
    // Use the staff-scoped endpoint (allows admin + superadmin).
    // /api/orders only allows customer + admin, so superadmin always 403s here.
    api.get("/admin/orders", { params: { status: "pending", limit: 1 } })
      .then((res) => {
        const total: number | undefined = res.data?.pagination?.total;
        if (typeof total === "number") {
          setPendingOrders(total);
          return;
        }
        const list: { status?: string }[] = res.data?.orders ?? [];
        setPendingOrders(list.filter((o) => o.status === "pending").length);
      })
      .catch(() => {});
  };

  useEffect(() => {
    api.get("/chat/conversations")
      .then((res) => {
        const convs: { unreadAdmin?: number }[] = res.data?.data ?? [];
        setUnreadChat(convs.reduce((s, c) => s + (c.unreadAdmin ?? 0), 0));
      })
      .catch(() => {});

    refreshPendingOrders();

    const socket = io(socketURL, { withCredentials: true, transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("conversation_updated", () => {
      api.get("/chat/conversations")
        .then((res) => {
          const convs: { unreadAdmin?: number }[] = res.data?.data ?? [];
          setUnreadChat(convs.reduce((s, c) => s + (c.unreadAdmin ?? 0), 0));
        })
        .catch(() => {});
    });

    socket.on("order_updated", () => refreshPendingOrders());

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getBadge = (badge?: "chat" | "orders") => {
    if (badge === "chat"   && unreadChat    > 0) return unreadChat    > 99 ? "99+" : String(unreadChat);
    if (badge === "orders" && pendingOrders > 0) return pendingOrders > 99 ? "99+" : String(pendingOrders);
    return null;
  };

  const getBadgeColor = (badge?: "chat" | "orders") => {
    if (badge === "chat")   return "bg-danger";
    if (badge === "orders") return "bg-warning";
    return "";
  };

  return (
    <aside className="w-60 h-screen flex flex-col shrink-0 bg-surface border-r border-line">
      {/* ── Brand ─────────────────────────────── */}
      <div className="px-5 pt-6 pb-5 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
            <Store size={20} className="text-white" />
            </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink leading-tight">7-Eleven</p>
            <p className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold uppercase tracking-wide ${isSuperAdmin ? "text-info" : "text-accent-ink"}`}>
              {isSuperAdmin ? <><Shield size={9} /> Super Admin</> : <><UserCircle size={9} /> Branch Admin</>}
            </p>
            </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {sections.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-2 text-faint">
                {section.heading}
              </p>
            )}

            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, badge }) => {
                const badgeVal = getBadge(badge);
                const isActive = location.pathname === to;

                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={() => `
                      group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
                      transition-colors relative
                      ${isActive
                        ? "bg-accent-soft text-accent-ink"
                        : "text-muted hover:bg-sunken hover:text-ink"
                      }
                    `}
                  >
                    {/* Active rail */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent-ink" />
                    )}

                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1 truncate">{label}</span>

                    {badgeVal && (
                      <span className={`
                        text-[10px] font-bold text-white rounded-full px-1.5 py-0.5
                        min-w-[18px] text-center leading-none ${getBadgeColor(badge)}
                      `}>
                        {badgeVal}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────── */}
      <div className="px-3 py-3 border-t border-line space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-muted hover:bg-sunken hover:text-ink transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-sunken">
            {isDark ? <Sun size={15} className="text-warning" /> : <Moon size={15} className="text-info" />}
          </div>
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>

        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sunken">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white ${isSuperAdmin ? "bg-info" : "bg-accent"}`}>
            {user?.firstname?.[0]}{user?.lastname?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink truncate">{user?.firstname} {user?.lastname}</p>
            <p className="text-[10px] text-faint truncate">{user?.email}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-danger hover:bg-danger-soft transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-danger-soft">
            <LogOut size={15} />
          </div>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
