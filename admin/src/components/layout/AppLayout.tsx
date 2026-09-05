import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useTheme } from "@/context/ThemeContext";

export default function AppLayout() {
  const { isDark } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className={`flex-1 overflow-y-auto ${isDark ? "bg-[#121212]" : "bg-[#F8F5F2]"}`}>
        <div className="max-w-7xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
