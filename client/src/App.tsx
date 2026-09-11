import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/auth-folder/Login";
import Dashboard from "@/pages/Dashboard";
import Branches from "@/pages/Branches";
import Admins from "@/pages/Admins";
import ActivityLog from "@/pages/ActivityLog";
import Profile from "@/pages/Profile";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Riders from "@/pages/Riders";
import Customers from "@/pages/Customers";
import Orders from "@/pages/Orders";
import Settings from "@/pages/Settings";
import Promos from "@/pages/Promos";
import type { JSX } from "react";

// Route guard: redirects to /login if not authenticated
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5F2] dark:bg-[#121212]">
        <div className="w-8 h-8 border-4 border-[#007A53] dark:border-[#078080] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  // Don't mount role-specific routes until auth resolves — otherwise a hard
  // load/refresh of /branches etc. matches the "*" catch-all and redirects
  // to /dashboard before the user's role is known.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5F2] dark:bg-[#121212]">
        <div className="w-8 h-8 border-4 border-[#007A53] dark:border-[#078080] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Shared routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/riders" element={<Riders />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/settings" element={<Settings />} />

        {/* Superadmin-only routes */}
        {isSuperadmin && (
          <>
            <Route path="/branches" element={<Branches />} />
            <Route path="/admins" element={<Admins />} />
            <Route path="/promos" element={<Promos />} />
            <Route path="/activity-log" element={<ActivityLog />} />
          </>
        )}

        {/* Admin-only routes */}
        {!isSuperadmin && (
          <>
            <Route path="/customers" element={<Customers />} />
          </>
        )}
      </Route>

      {/* Default redirect */}
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
