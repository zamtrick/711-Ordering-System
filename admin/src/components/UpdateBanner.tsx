import { useEffect, useState } from "react";
import { applyUpdate } from "@/pwa";

/* Bottom prompt shown when the service worker has a new version waiting.
 * Reload only happens after the user taps Reload, so an update can never
 * yank the page mid-order-processing (matches the sw.js no-skipWaiting flow).
 */
export default function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener("sw-update-ready", onReady);
    return () => window.removeEventListener("sw-update-ready", onReady);
  }, []);

  if (!ready) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-96 z-50 rounded-2xl border border-line bg-surface shadow-xl px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ink dark:text-white">New version available</p>
        <p className="text-xs text-muted">Reload to get the latest update.</p>
      </div>
      <button
        onClick={applyUpdate}
        className="h-9 px-4 shrink-0 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 transition-opacity cursor-pointer"
      >
        Reload
      </button>
      <button
        onClick={() => setReady(false)}
        className="h-9 px-3 shrink-0 rounded-xl text-sm font-semibold text-muted hover:text-ink dark:hover:text-white transition-colors cursor-pointer"
      >
        Later
      </button>
    </div>
  );
}
