/* Registers the admin service worker and surfaces update events.
 *
 * Kept in its own module so main.tsx stays clean. `sw.js` lives in
 * public/ and is copied verbatim into the build output, so the URL is
 * stable across deploys.
 *
 * Update flow: the SW no longer skipWaiting()s itself. When a new version
 * is installed while an old one controls the page, we dispatch
 * "sw-update-ready" — the UpdateBanner shows a Reload prompt, and only
 * after the user accepts do we post SKIP_WAITING. The controllerchange
 * event that follows then reloads the page once onto the new version.
 */

let waitingWorker: ServiceWorker | null = null;
let updateAccepted = false;
let reloaded = false;

/** Called by the UpdateBanner's Reload button. */
export function applyUpdate() {
  if (!waitingWorker) return;
  updateAccepted = true;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");

      const announce = (worker: ServiceWorker) => {
        waitingWorker = worker;
        window.dispatchEvent(new CustomEvent("sw-update-ready"));
      };

      // An update may already be sitting in `waiting` (e.g. the tab was
      // reloaded before the user clicked Reload last time).
      if (reg.waiting && navigator.serviceWorker.controller) {
        announce(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // "installed" with an existing controller = update, not first install.
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            announce(installing);
          }
        });
      });

      // Fires when a new SW takes control — but also on first install
      // (clients.claim), so only reload when the user actually accepted.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (updateAccepted && !reloaded) {
          reloaded = true;
          window.location.reload();
        }
      });
    } catch (err) {
      // Non-fatal: the app works fine without offline shell caching.
      console.warn("Service worker registration failed:", err);
    }
  });
}
