import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Escape closes the drawer too.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // The chat page is a full-height two-panel messenger — it needs the whole
  // main area (no max-width column) so neither panel gets squeezed or clipped.
  // It manages its own padding; h-full + py-6 works because preflight sets
  // box-sizing: border-box (the border box equals main's height, so the
  // content box the chat fills is exactly main minus the padding).
  const isFullBleed = pathname === "/chat";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Mobile top bar (hidden on desktop) ─────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 px-4 flex items-center gap-3 bg-surface border-b border-line">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
          className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-xl text-muted hover:bg-sunken hover:text-ink transition-colors cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <p className="text-sm font-bold text-ink dark:text-white">7-Eleven Admin</p>
      </header>

      {/* ── Sidebar: static on desktop, slide-over drawer on mobile ── */}
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      {/* Backdrop behind the open mobile drawer */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50 cursor-default"
        />
      )}

      <main className="flex-1 overflow-y-auto bg-canvas pt-14 md:pt-0">
        {isFullBleed ? (
          <div className="h-full px-4 md:px-6 py-6">
            <Outlet />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
