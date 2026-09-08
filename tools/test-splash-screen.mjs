// Verify the splash screen on Expo web by polling the DOM:
// 1. splash appears (tagline "7-Eleven Online Ordering" in body text)
// 2. screenshot while visible
// 3. splash hides and the app boots (login form) with no console errors
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9342;
const EXPO = "http://10.0.75.231:8081";
const OUT = "C:/Users/Patrick Zambrano/AppData/Local/Temp";
const TAGLINE = "7-Eleven Online Ordering";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  "--user-data-dir=" + OUT + "/cdp-profile-splash",
  `--remote-debugging-port=${CDP_PORT}`,
  "--window-size=420,900",
], { stdio: "ignore" });

async function getJson(url) {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {}
    await sleep(250);
  }
  throw new Error("CDP not reachable");
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
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    consoleErrors.push(msg.params.entry.text.slice(0, 200));
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
await send("Runtime.enable");
await send("Page.enable");

const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

// helper: poll an expression until truthy (or timeout)
const pollUntil = async (expression, timeoutMs, step = 120) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await evalJs(expression).catch(() => null);
    if (v) return Date.now() - start;
    await sleep(step);
  }
  return -1;
};

let passed = 0, failed = 0;
const ok = (label, cond, extra = "") => {
  cond ? (passed++, console.log(`✅ ${label}${extra ? ` — ${extra}` : ""}`))
       : (failed++, console.log(`❌ ${label}${extra ? ` — ${extra}` : ""}`));
};

const t0 = Date.now();

// ── 0. navigate (don't await — the splash may appear while still loading) ─────
send("Page.navigate", { url: EXPO }).catch(() => {});

// ── 1. wait for the splash to appear ──────────────────────────────────────────
const shownAt = await pollUntil(
  `document.body?.innerText?.includes(${JSON.stringify(TAGLINE)}) ?? false`,
  20000,
);
const showStamp = Date.now() - t0;
ok("splash appeared on boot", shownAt >= 0, shownAt >= 0 ? `detected at t+${showStamp}ms` : "never appeared");

// ── 2. inspect + screenshot the visible splash ───────────────────────────────
if (shownAt >= 0) {
  // RN Web renders <Image> as a background-image div and only paints it once
  // the asset loads, so poll for logo evidence within the visible window.
  const logoExpr = `(() => {
    const ov = document.querySelector('[data-testid="app-splash"]');
    if (!ov) return null;
    return {
      bg: getComputedStyle(ov).backgroundColor,
      hasLogo: ov.innerHTML.includes("711logo") || ov.querySelectorAll("img").length > 0,
    };
  })()`;

  let splashState = null;
  const logoStart = Date.now();
  while (Date.now() - logoStart < 3000) {
    splashState = await evalJs(logoExpr).catch(() => null);
    if (splashState?.hasLogo) break;
    await sleep(150);
  }
  console.log("splash overlay:", JSON.stringify(splashState));

  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/splash-visible.png`, Buffer.from(s.data, "base64"));
  console.log("shot: splash-visible.png");

  ok("splash background is brand green or dark", splashState && (splashState.bg === "rgb(0, 122, 83)" || splashState.bg === "rgb(18, 18, 18)"), splashState?.bg ?? "n/a");
  ok("splash shows the 711 logo image", splashState?.hasLogo === true);
}

// ── 3. wait for the splash to hide ────────────────────────────────────────────
const hiddenAfter = await pollUntil(
  `!document.body?.innerText?.includes(${JSON.stringify(TAGLINE)})`,
  15000,
);
const hideStamp = Date.now() - t0;
const visibleMs = hideStamp - showStamp;
ok("splash hid after boot", hiddenAfter >= 0, hiddenAfter >= 0 ? `at t+${hideStamp}ms` : "still visible");
ok("splash stayed visible >= 1s (perceivable)", visibleMs >= 1000, `${visibleMs}ms`);

// ── 4. app booted after the splash ────────────────────────────────────────────
const bootedAt = await pollUntil(
  `!!document.querySelector('input[placeholder="Enter your email"]')`,
  15000,
);
const logos = await evalJs(
  `[...document.querySelectorAll("img")].filter(i => (i.src||"").includes("711logo")).map(i => i.naturalWidth)`,
);
ok("app booted (login form rendered)", bootedAt >= 0);
ok("711 logo renders in the app", (logos?.length ?? 0) > 0 && logos.every((w) => w > 0), `${logos?.length ?? 0} img(s)`);
await (async () => {
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/splash-final.png`, Buffer.from(s.data, "base64"));
})();

console.log(`\nconsole errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((e) => console.log("  •", e));
ok("no console errors", consoleErrors.length === 0);

console.log(`\n=== ${passed} passed, ${failed} failed ===`);

chrome.kill();
process.exit(failed > 0 ? 1 : 0);
