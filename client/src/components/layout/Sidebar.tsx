import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  LogOut,
  Store,
  Activity,
  Settings,
  Sun,
  Moon,
  Package,
  Tags,
  Truck,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const superadminNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/branches", label: "Branches", icon: GitBranch },
  { to: "/admins", label: "Admins", icon: Users },
  { to: "/activity-log", label: "Activity Log", icon: Activity },
  { to: "/profile", label: "Profile & Settings", icon: Settings },
];

const adminNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/riders", label: "Riders", icon: Truck },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();

  const isSuperadmin = user?.role === "superadmin";
  const navItems = isSuperadmin ? superadminNav : adminNav;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const bg = isDark ? "bg-[#1E1E1E]" : "bg-white";
  const border = isDark ? "border-[#2E2E2E]" : "border-[#E5E2DE]";
  const text = isDark ? "text-white" : "text-[#232323]";
  const muted = isDark ? "text-[#A0A0A0]" : "text-[#777777]";
  const navHover = isDark ? "hover:bg-[#2A2A2A]" : "hover:bg-[#F8F5F2]";
  const navActiveBg = isDark ? "bg-[#0A3D3D]" : "bg-[#E8F5EF]";
  const navActiveText = isDark ? "text-[#078080]" : "text-[#007A53]";
  const navInactive = isDark ? "text-[#A0A0A0]" : "text-[#555555]";
  const iconBg = isDark ? "bg-[#0A3D3D]" : "bg-[#007A53]";

  return (
    <aside className={`w-64 h-screen flex flex-col ${bg} border-r ${border} shrink-0`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-5 py-5 border-b ${border}`}>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Store size={20} className="text-white" />
        </div>
        <div>
          <p className={`text-sm font-bold ${text} leading-tight`}>7-Eleven</p>
          <p className={`text-xs ${muted} leading-tight`}>
            {isSuperadmin ? "Superadmin Panel" : "Admin Panel"}
          </p>
        </div>
      </div>

      {/* Role Badge */}
      <div className={`px-5 py-3 border-b ${border}`}>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
          isSuperadmin
            ? "bg-[#EEF2FF] dark:bg-[#1A1A3D] text-[#4F46E5]"
            : "bg-[#E8F5EF] dark:bg-[#0A3D3D] text-[#007A53] dark:text-[#4CAF50]"
        }`}>
          {isSuperadmin ? "⚡ Superadmin" : "🔧 Admin"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? `${navActiveBg} ${navActiveText}`
                  : `${navInactive} ${navHover}`,
              ].join(" ")
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className={`px-4 py-4 border-t ${border}`}>
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium ${navInactive} ${navHover} transition-colors cursor-pointer mb-2`}
        >
          {isDark ? <Sun size={18} className="text-[#FF6720]" /> : <Moon size={18} className="text-[#4F46E5]" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>

        <div className="mb-3">
          <p className={`text-sm font-semibold ${text} truncate`}>
            {user?.firstname} {user?.lastname}
          </p>
          <p className={`text-xs ${muted} truncate`}>{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-[#DA291C] hover:bg-[#FFF0F0] dark:hover:bg-[#3D1515] transition-colors cursor-pointer"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
