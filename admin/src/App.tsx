import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Branches from "@/pages/Branches";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Riders from "@/pages/Riders";
import Customers from "@/pages/Customers";
import BranchInventory from "@/pages/BranchInventory";
import Chat from "@/pages/Chat";
import Orders from "@/pages/Orders";
import Admins from "@/pages/Admins";
import Settings from "@/pages/Settings";
import Promos from "@/pages/Promos";
import Profile from "@/pages/Profile";
import ActivityLog from "@/pages/ActivityLog";
import type { JSX } from "react";

function ProtectedRoute({ children, superadminOnly = false }: { children: JSX.Element; superadminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) return <Navigate to="/login" replace />;
  if (superadminOnly && user.role !== "superadmin") return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admins" element={<ProtectedRoute superadminOnly><Admins /></ProtectedRoute>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/promos" element={<ProtectedRoute superadminOnly><Promos /></ProtectedRoute>} />
        <Route path="/activity-log" element={<ProtectedRoute superadminOnly><ActivityLog /></ProtectedRoute>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/branch-inventory" element={<BranchInventory />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/riders" element={<Riders />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/chat" element={<Chat />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
