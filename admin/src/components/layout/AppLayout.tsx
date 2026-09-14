import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const { pathname } = useLocation();

  // The chat page is a full-height two-panel messenger — it needs the whole
  // main area (no max-width column) so neither panel gets squeezed or clipped.
  // It manages its own padding; h-full + py-6 works because preflight sets
  // box-sizing: border-box (the border box equals main's height, so the
  // content box the chat fills is exactly main minus the padding).
  const isFullBleed = pathname === "/chat";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-canvas">
        {isFullBleed ? (
          <div className="h-full px-6 py-6">
            <Outlet />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-8 py-8">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
