/* Registers the admin service worker.
 *
 * Kept in its own module so main.tsx stays clean. `sw.js` lives in
 * public/ and is copied verbatim into the build output, so the URL is
 * stable across deploys.
 */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Non-fatal: the app works fine without offline shell caching.
      console.warn("Service worker registration failed:", err);
    });
  });
}
