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
  ChevronRight,
  Shield,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
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
  accent?: string; // tailwind text color for icon
  iconBg?: string; // tailwind bg for icon pill
};

type NavSection = {
  heading?: string;
  items: NavItem[];
};

const superadminNav: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard",  icon: LayoutDashboard, accent: "text-[#007A53]", iconBg: "bg-[#E8F5EF] dark:bg-[#0A3D3D]" },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { to: "/products",   label: "Products",   icon: Package,  accent: "text-[#7C3AED]", iconBg: "bg-[#F5F3FF] dark:bg-[#2A1A3D]" },
      { to: "/categories", label: "Categories", icon: Tags,     accent: "text-[#059669]", iconBg: "bg-[#ECFDF5] dark:bg-[#0A2D1D]" },
    ],
  },
  {
    heading: "Network",
    items: [
      { to: "/branches", label: "Branches", icon: MapPin, accent: "text-[#FF6720]", iconBg: "bg-[#FFF3E8] dark:bg-[#3D2A15]" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/orders",  label: "Orders",  icon: ShoppingBag,   badge: "orders", accent: "text-[#4F46E5]", iconBg: "bg-[#EEF2FF] dark:bg-[#1A1A3D]" },
      { to: "/riders",  label: "Riders",  icon: Truck,                          accent: "text-[#007A53]", iconBg: "bg-[#E8F5EF] dark:bg-[#0A3D3D]" },
      { to: "/chat",    label: "Chat",    icon: MessageCircle, badge: "chat",   accent: "text-[#DA291C]", iconBg: "bg-[#FFF0F0] dark:bg-[#3D1515]"  },
    ],
  },
];

const adminNav: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, accent: "text-[#007A53]", iconBg: "bg-[#E8F5EF] dark:bg-[#0A3D3D]" },
    ],
  },
  {
    heading: "My Branch",
    items: [
      { to: "/branch-inventory", label: "Inventory",  icon: Boxes, accent: "text-[#7C3AED]", iconBg: "bg-[#F5F3FF] dark:bg-[#2A1A3D]" },
      { to: "/customers",        label: "Customers",  icon: Users, accent: "text-[#FF6720]", iconBg: "bg-[#FFF3E8] dark:bg-[#3D2A15]" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/orders", label: "Orders", icon: ShoppingBag,   badge: "orders", accent: "text-[#4F46E5]", iconBg: "bg-[#EEF2FF] dark:bg-[#1A1A3D]" },
      { to: "/riders", label: "Riders", icon: Truck,                          accent: "text-[#007A53]", iconBg: "bg-[#E8F5EF] dark:bg-[#0A3D3D]" },
      { to: "/chat",   label: "Chat",   icon: MessageCircle, badge: "chat",   accent: "text-[#DA291C]", iconBg: "bg-[#FFF0F0] dark:bg-[#3D1515]"  },
    ],
  },
];

const socketURL = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = user?.role === "superadmin";
  const sections = isSuperAdmin ? superadminNav : adminNav;

  const [unreadChat, setUnreadChat]       = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const refreshPendingOrders = () => {
    api.get("/orders")
      .then((res) => {
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
    if (badge === "chat")   return "bg-[#DA291C]";
    if (badge === "orders") return "bg-[#FF6720]";
    return "";
  };

  return (
    <aside
      className={`
        w-60 h-screen flex flex-col shrink-0
        ${isDark ? "bg-[#161616]" : "bg-white"}
        border-r ${isDark ? "border-[#252525]" : "border-[#EBEBEB]"}
      `}
    >
      {/* ── Brand ─────────────────────────────── */}
      <div className={`px-5 pt-6 pb-5 border-b ${isDark ? "border-[#252525]" : "border-[#EBEBEB]"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#007A53] flex items-center justify-center shadow-sm shrink-0">
            <Store size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-extrabold leading-tight ${isDark ? "text-white" : "text-[#111]"}`}>
              7-Eleven
            </p>
            <div className={`
              inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold
              ${isSuperAdmin
                ? "bg-[#4F46E5]/10 text-[#4F46E5]"
                : "bg-[#007A53]/10 text-[#007A53]"}
            `}>
              {isSuperAdmin
                ? <><Shield size={9} /> Super Admin</>
                : <><UserCircle size={9} /> Branch Admin</>
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {sections.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <p className={`
                text-[10px] font-bold uppercase tracking-widest mb-1.5 px-2
                ${isDark ? "text-[#555]" : "text-[#BABABA]"}
              `}>
                {section.heading}
              </p>
            )}

            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, badge, accent, iconBg }) => {
                const badgeVal   = getBadge(badge);
                const badgeColor = getBadgeColor(badge);
                const isActive   = location.pathname === to;

                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={() => `
                      group flex items-center gap-3 px-3 py-2.5 rounded-xl
                      text-sm font-medium transition-all duration-150
                      ${isActive
                        ? isDark
                          ? "bg-[#1E1E1E] text-white shadow-sm"
                          : "bg-[#F4FBF8] text-[#007A53] shadow-sm"
                        : isDark
                          ? "text-[#888] hover:bg-[#1E1E1E] hover:text-white"
                          : "text-[#666] hover:bg-[#F8F8F8] hover:text-[#111]"
                      }
                    `}
                  >
                    {/* Icon pill */}
                    <div className={`
                      w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                      transition-all duration-150
                      ${isActive
                        ? (iconBg ?? "bg-[#E8F5EF] dark:bg-[#0A3D3D]")
                        : isDark
                          ? "bg-[#252525] group-hover:bg-[#2E2E2E]"
                          : "bg-[#F2F2F2] group-hover:bg-[#E8E8E8]"
                      }
                    `}>
                      <Icon
                        size={15}
                        className={isActive ? (accent ?? "text-[#007A53]") : isDark ? "text-[#666]" : "text-[#999]"}
                      />
                    </div>

                    <span className="flex-1 truncate">{label}</span>

                    {/* Active indicator */}
                    {isActive && !badgeVal && (
                      <ChevronRight size={13} className={isDark ? "text-[#444]" : "text-[#007A53]/40"} />
                    )}

                    {/* Live badge */}
                    {badgeVal && (
                      <span className={`
                        text-[10px] font-bold text-white rounded-full px-1.5 py-0.5
                        min-w-[18px] text-center leading-none ${badgeColor}
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
      <div className={`px-3 py-3 border-t ${isDark ? "border-[#252525]" : "border-[#EBEBEB]"} space-y-1`}>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`
            flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
            text-sm font-medium transition-colors
            ${isDark ? "text-[#888] hover:bg-[#1E1E1E] hover:text-white" : "text-[#666] hover:bg-[#F8F8F8] hover:text-[#111]"}
          `}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? "bg-[#252525]" : "bg-[#F2F2F2]"}`}>
            {isDark
              ? <Sun  size={15} className="text-[#FF6720]" />
              : <Moon size={15} className="text-[#4F46E5]" />
            }
          </div>
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>

        {/* User card */}
        <div className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl
          ${isDark ? "bg-[#1E1E1E]" : "bg-[#F8F8F8]"}
        `}>
          <div className={`
            w-8 h-8 rounded-xl flex items-center justify-center shrink-0
            text-xs font-extrabold text-white
            ${isSuperAdmin ? "bg-[#4F46E5]" : "bg-[#007A53]"}
          `}>
            {user?.firstname?.[0]}{user?.lastname?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold truncate ${isDark ? "text-white" : "text-[#111]"}`}>
              {user?.firstname} {user?.lastname}
            </p>
            <p className={`text-[10px] truncate ${isDark ? "text-[#666]" : "text-[#AAA]"}`}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-[#DA291C] hover:bg-[#FFF0F0] dark:hover:bg-[#2A1010] transition-colors"
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#FFF0F0] dark:bg-[#2A1010]">
            <LogOut size={15} className="text-[#DA291C]" />
          </div>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
