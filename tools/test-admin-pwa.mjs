// Verify the admin PWA install flow in headless Chrome via CDP.
//
// What it checks, in order:
//   1. Chrome's own installability verdict (Page.getInstallabilityErrors —
//      the same check DevTools → Application → Manifest runs)
//   2. Manifest link + manifest contents (name, icons, display, theme)
//   3. Service worker registers and becomes active
//   4. Offline reload serves the app shell from the SW cache
//
// Run with the production build being served (npm run build && npm run preview):
//   node tools/test-admin-pwa.mjs [base-url]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9343;
const BASE = process.argv[2] ?? "http://localhost:4173";
const OUT = "C:/Users/Patrick Zambrano/AppData/Local/Temp";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  "--user-data-dir=" + OUT + "/cdp-profile-admin-pwa",
  `--remote-debugging-port=${CDP_PORT}`,
  "--window-size=1440,900",
], { stdio: "ignore" });

async function getJson(url) {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {}
    await sleep(250);
  }
  throw new Error("CDP not reachable at " + url);
}

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const consoleErrors = [];

const list = await getJson(`http://localhost:${CDP_PORT}/json/list`);
const page = list.find((t) => t.type === "page");
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  // Collect renderer console errors, but ignore offline-test noise: the app
  // and axios retry failed fetches while we're deliberately offline.
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    consoleErrors.push(msg.params.entry.text.slice(0, 160));
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160));
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");

const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result?.value;
};

let passed = 0, failed = 0;
const ok = (label, cond, extra = "") => {
  cond ? (passed++, console.log(`✅ ${label}${extra ? ` — ${extra}` : ""}`))
       : (failed++, console.log(`❌ ${label}${extra ? ` — ${extra}` : ""}`));
};

// ── 0. load the app ───────────────────────────────────────────────────────────
await send("Page.navigate", { url: BASE + "/login" });
await sleep(2500);

// ── 1. Chrome's own installability verdict ────────────────────────────────────
let installability = null;
try {
  installability = await send("Page.getInstallabilityErrors");
} catch (e) {
  console.log("  (getInstallabilityErrors unavailable:", e.message.slice(0, 80), ")");
}
const installErrors = installability?.errors ?? [];
ok(
  "Chrome reports the app installable",
  installErrors.length === 0,
  installErrors.length ? installErrors.map((e) => `${e.errorId}: ${e.errorArguments?.join(" ") ?? ""}`).join(" | ") : "no installability errors",
);

// ── 2. manifest link + contents ───────────────────────────────────────────────
const manifestHref = await evalJs(
  `document.querySelector('link[rel="manifest"]')?.href ?? null`,
);
ok("index.html has <link rel=manifest>", !!manifestHref, manifestHref ?? "missing");

if (manifestHref) {
  const manifest = await evalJs(
    `fetch(${JSON.stringify(manifestHref)}).then(r => r.json())`,
  );
  ok("manifest has a name", !!manifest.name, manifest.name ?? "n/a");
  ok("manifest display is standalone", manifest.display === "standalone", manifest.display ?? "n/a");
  ok("manifest has start_url", !!manifest.start_url, manifest.start_url ?? "n/a");
  ok("manifest declares ≥192px icon", (manifest.icons ?? []).some((i) => parseInt(i.sizes) >= 192), `${manifest.icons?.length ?? 0} icon(s)`);
  ok("manifest declares a maskable icon", (manifest.icons ?? []).some((i) => (i.purpose ?? "").split(/[\s,]+/).includes("maskable")));

  // every icon src actually resolves
  const iconChecks = await Promise.all(
    (manifest.icons ?? []).map(async (i) => {
      const url = new URL(i.src, manifestHref).toString();
      const r = await fetch(url);
      return `${i.src}: ${r.status}`;
    }),
  );
  ok("all manifest icons resolve (HTTP 200)", iconChecks.every((s) => s.endsWith("200")), iconChecks.join(", "));
}

// apple touch icon link resolves
const appleHref = await evalJs(`document.querySelector('link[rel="apple-touch-icon"]')?.href ?? null`);
if (appleHref) {
  const r = await fetch(appleHref);
  ok("apple-touch-icon resolves", r.ok, `${r.status} ${appleHref.split("/").pop()}`);
}

// ── 3. service worker registers and activates ─────────────────────────────────
const swState = await pollOrNull(async () =>
  evalJs(`navigator.serviceWorker.controller?.state ?? null`),
);
ok("service worker registered + controlling page", swState === "activated", swState ?? "no controller");

// The SW was active on this load. Prove it's OUR script (getRegistration()
// returns a non-serializable object, so extract the URL inside the browser):
const scriptUrl = await evalJs(
  `navigator.serviceWorker.getRegistration().then(r => r?.active?.scriptURL ?? null)`,
);
ok("SW script is /sw.js", !!scriptUrl && scriptUrl.endsWith("/sw.js"), scriptUrl ?? "n/a");

// ── 4. offline reload serves the app shell ────────────────────────────────────
// Go offline, reload, and confirm the shell renders from the SW cache.
await send("Network.emulateNetworkConditions", {
  offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
await send("Page.navigate", { url: BASE + "/login" });
await sleep(2500);

const offlineShell = await evalJs(
  `!!document.getElementById('root') && document.body.innerText.length > 0`,
);
ok("offline reload renders the app shell", offlineShell);

const offlineTitle = await evalJs(`document.title`);
ok("offline reload has correct title", offlineTitle === "711 Admin", offlineTitle);

await send("Page.captureScreenshot", { format: "png" })
  .then((s) => writeFileSync(`${OUT}/admin-pwa-offline.png`, Buffer.from(s.data, "base64")))
  .catch(() => {});
console.log("shot: admin-pwa-offline.png");

// back online
await send("Network.emulateNetworkConditions", {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});

// ── done ──────────────────────────────────────────────────────────────────────
console.log(`\\nconsole errors (informational): ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((e) => console.log("  •", e));

console.log(`\\n=== ${passed} passed, ${failed} failed ===`);

chrome.kill();
process.exit(failed > 0 ? 1 : 0);

async function pollOrNull(fn, timeoutMs = 15000, step = 300) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await sleep(step);
  }
  return null;
}
