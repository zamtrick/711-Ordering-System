import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { JSX } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import AppLayout from "@/components/layout/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import UpdateBanner from "@/components/UpdateBanner";

// Route-level code splitting: each page ships as its own chunk and is
// fetched on first visit, keeping the initial bundle small. All pages
// use default exports, which is what React.lazy expects.
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Branches = lazy(() => import("@/pages/Branches"));
const Products = lazy(() => import("@/pages/Products"));
const Categories = lazy(() => import("@/pages/Categories"));
const Riders = lazy(() => import("@/pages/Riders"));
const Customers = lazy(() => import("@/pages/Customers"));
const BranchInventory = lazy(() => import("@/pages/BranchInventory"));
const Chat = lazy(() => import("@/pages/Chat"));
const Orders = lazy(() => import("@/pages/Orders"));
const Loyalty = lazy(() => import("@/pages/Loyalty"));
const Admins = lazy(() => import("@/pages/Admins"));
const Settings = lazy(() => import("@/pages/Settings"));
const Promos = lazy(() => import("@/pages/Promos"));
const AppOpenAds = lazy(() => import("@/pages/AppOpenAds"));
const Profile = lazy(() => import("@/pages/Profile"));
const ActivityLog = lazy(() => import("@/pages/ActivityLog"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children, superadminOnly = false }: { children: JSX.Element; superadminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) return <Navigate to="/login" replace />;
  if (superadminOnly && user.role !== "superadmin") return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admins" element={<ProtectedRoute superadminOnly><Admins /></ProtectedRoute>} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/promos" element={<ProtectedRoute superadminOnly><Promos /></ProtectedRoute>} />
            <Route path="/app-open-ads" element={<AppOpenAds />} />
            <Route path="/activity-log" element={<ProtectedRoute superadminOnly><ActivityLog /></ProtectedRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/branches" element={<Branches />} />
            <Route path="/branch-inventory" element={<BranchInventory />} />
            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/riders" element={<Riders />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/loyalty" element={<Loyalty />} />
            <Route path="/chat" element={<Chat />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <UpdateBanner />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
