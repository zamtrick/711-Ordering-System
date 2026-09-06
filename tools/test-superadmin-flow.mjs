// Full superadmin UI flow test via headless Chrome + CDP.
// Captures: console errors, failed network requests, DOM verification per page.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9333;
const BASE = "http://localhost:5173";
const OUT = "C:/Users/Patrick Zambrano/AppData/Local/Temp";

// read superadmin creds from server/.env
const env = readFileSync(join(process.cwd(), "server/.env"), "utf8");
const EMAIL = env.match(/SUPERADMIN_EMAIL=(.+)/)?.[1]?.trim();
const PASSWORD = env.match(/SUPERADMIN_PASSWORD=(.+)/)?.[1]?.trim();
if (!EMAIL || !PASSWORD) throw new Error("missing superadmin creds");

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--user-data-dir=" + OUT + "/cdp-profile",
  `--remote-debugging-port=${CDP_PORT}`,
  "--window-size=1440,900",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
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

async function connect() {
  const list = await getJson(`http://localhost:${CDP_PORT}/json/list`);
  const page = list.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    // ── diagnostics collection ──
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      consoleErrors.push(msg.params.entry.text.slice(0, 300));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push("EXCEPTION: " + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === "Network.responseReceived") {
      const { status, url } = msg.params.response;
      if (status >= 400 && !url.includes("/auth/login") && !url.includes("/auth/me")) {
        failedRequests.push(`[${status}] ${url.replace(BASE, "")}`);
      }
    }
    // ── RPC resolution ──
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
}

// ── diagnostics collectors ────────────────────────────────────────────────────
const consoleErrors = [];
const failedRequests = [];

await connect();

// Enable domains needed for diagnostics
await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");

async function nav(url, waitMs = 2200) {
  await send("Page.navigate", { url });
  await sleep(waitMs);
}

async function shot(name) {
  const res = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(res.data, "base64"));
  console.log("shot:", name);
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

async function setInput(selector, value) {
  await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function click(selector) {
  return evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
}

// ── report helpers ────────────────────────────────────────────────────────────
const issues = [];

async function verifyPage(name, h1Expected, mustContain = []) {
  const h1 = await evaluate(`document.querySelector("h1")?.textContent ?? ""`);
  const body = await evaluate(`document.body.innerText`);
  const problems = [];

  if (h1Expected && !h1.toLowerCase().includes(h1Expected.toLowerCase())) {
    problems.push(`h1 is "${h1}", expected to include "${h1Expected}"`);
  }
  for (const text of mustContain) {
    if (!body.includes(text)) problems.push(`missing expected text: "${text}"`);
  }
  // Common error markers
  for (const bad of ["Access denied", "Internal Server Error", "Failed to load", "Failed to create", "Failed to update", "Failed to delete"]) {
    if (body.includes(bad)) problems.push(`error text on page: "${bad}"`);
  }
  if (body.includes("NaN")) problems.push(`"NaN" rendered on page`);
  if (/\bundefined\b/.test(body)) problems.push(`"undefined" rendered on page`);

  if (problems.length) {
    issues.push({ page: name, problems });
    console.log(`  PAGE ISSUES [${name}]:`, problems.join(" | "));
  } else {
    console.log(`  page OK [${name}] h1="${h1}"`);
  }
}

// ── start browser flow ────────────────────────────────────────────────────────
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// Start clean: no stale session cookies from previous runs
await send("Network.clearBrowserCookies");
await send("Runtime.evaluate", { expression: "localStorage.clear()" });

console.log("\n=== 1. LOGIN PAGE ===");
await nav(BASE + "/login");
await sleep(1500);
await shot("sa-login");
await verifyPage("login", "welcome", ["Email", "Password"]);

console.log("\n=== 2. LOGIN ACTION ===");
await setInput('input[type="email"]', EMAIL);
await setInput('input[type="password"]', PASSWORD);
await click('button[type="submit"]');
await sleep(4000);

const url1 = await evaluate("location.pathname");
console.log("  after login pathname:", url1);
if (!url1.includes("dashboard")) {
  const err = await evaluate(`document.querySelector('.text-\\\\[\\\\#DA291C\\\\]')?.textContent ?? document.body.innerText.slice(0,200)`);
  issues.push({ page: "login", problems: ["login did not reach /dashboard, pathname=" + url1 + " err=" + err] });
}
await shot("sa-dashboard");
await verifyPage("dashboard", "dashboard", ["Welcome back"]);

console.log("\n=== 3. BRANCHES (CRUD) ===");
await nav(BASE + "/branches");
await sleep(2000);
await verifyPage("branches", "branches", ["Add Branch"]);
const branchCountBefore = await evaluate(`document.querySelectorAll("tbody tr").length`);
console.log("  branch rows:", branchCountBefore);

// Create branch
await click('button:has(> svg)'); // fallback no-op; use text search below
await evaluate(`(() => {
  const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Add Branch"));
  if (btn) btn.click();
  return !!btn;
})()`);
await sleep(1200);
const modalOpen = await evaluate(`!!document.querySelector("form")`);
console.log("  add-branch modal open:", modalOpen);

if (modalOpen) {
  const uniq = Date.now().toString().slice(-6);
  await setInput('input[placeholder*="Main Branch"]', `UI Test Branch ${uniq}`);
  await setInput('input[placeholder*="BR001"]', `UI${uniq}`);
  await setInput('input[placeholder*="North District"]', "UI District");
  await setInput('input[placeholder*="Manila"]', "UI City");
  // Check the "Cash" payment checkbox (required by validation)
  await evaluate(`(() => {
    const cb = [...document.querySelectorAll('input[type="checkbox"]')].find(c => c.closest('label')?.textContent.includes('Cash'));
    if (cb && !cb.checked) cb.click();
    return !!cb;
  })()`);
  await shot("sa-branch-form");
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Create Branch')); if(b) b.click(); })()`);
  // Poll for the success toast (auto-dismisses quickly)
  let toastSeen = false;
  for (let i = 0; i < 10; i++) {
    await sleep(500);
    const txt = await evaluate(`document.body.innerText`);
    if (txt.includes("created successfully")) { toastSeen = true; break; }
  }
  if (toastSeen) console.log("  branch created OK (toast seen)");
  else issues.push({ page: "branches-create", problems: ["no success toast after create"] });
  await shot("sa-branch-created");

  // cleanup: delete the branch we just created
  await evaluate(`(() => {
    const row = [...document.querySelectorAll("tbody tr")].find(r => r.textContent.includes("UI Test Branch"));
    const btn = row && [...row.querySelectorAll("button")].find(b => b.textContent.includes("Delete"));
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(1000);
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Delete') && x.closest('[class*="fixed"]')); if(b) b.click(); return !!b; })()`);
  await sleep(2000);
  console.log("  branch cleanup done");
}

console.log("\n=== 4. ADMINS ===");
await nav(BASE + "/admins");
await sleep(2000);
await verifyPage("admins", "admins", ["Add Admin"]);
const adminRows = await evaluate(`document.querySelectorAll("tbody tr").length`);
console.log("  admin rows:", adminRows);
await shot("sa-admins");

// Verify branch dropdown populates (was broken before /admin/branches fix — actually uses superadmin route)
await evaluate(`(() => { const b=[...document.querySelectorAll("button")].find(x => x.textContent.includes("Add Admin")); if(b) b.click(); })()`);
await sleep(1000);
const branchOptions = await evaluate(`[...document.querySelectorAll("select option")].filter(o => o.value).length`);
console.log("  branch dropdown options:", branchOptions);
if (branchOptions === 0) issues.push({ page: "admins", problems: ["branch dropdown has no options"] });
await shot("sa-admin-modal");
await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Cancel'); if(b) b.click(); })()`);
await sleep(600);

console.log("\n=== 5. ACTIVITY LOG ===");
await nav(BASE + "/activity-log");
await sleep(2000);
await verifyPage("activity-log", "activity log", ["Action"]);
const logRows = await evaluate(`document.querySelectorAll("tbody tr").length`);
console.log("  log rows:", logRows);
if (logRows === 0) issues.push({ page: "activity-log", problems: ["no log rows rendered"] });
await shot("sa-activity-log");

console.log("\n=== 6. PROFILE ===");
await nav(BASE + "/profile");
await sleep(2000);
await verifyPage("profile", "profile", ["Edit Profile", "Change Password"]);
await shot("sa-profile");

// Save profile with same values (idempotent PATCH)
await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Save Changes')); if(b) b.click(); })()`);
let profToastSeen = false;
for (let i = 0; i < 10; i++) {
  await sleep(500);
  const txt = await evaluate(`document.body.innerText`);
  if (txt.includes("updated successfully")) { profToastSeen = true; break; }
}
if (profToastSeen) console.log("  profile save OK");
else issues.push({ page: "profile-save", problems: ["no success toast on profile save"] });

console.log("\n=== 7. LOGOUT ===");
await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Logout')); if(b) b.click(); })()`);
await sleep(2500);
const urlOut = await evaluate("location.pathname");
console.log("  after logout pathname:", urlOut);
if (!urlOut.includes("login")) issues.push({ page: "logout", problems: ["did not return to /login, pathname=" + urlOut] });

// ── summary ───────────────────────────────────────────────────────────────────
console.log("\n════════════════ SUMMARY ════════════════");
if (consoleErrors.length) {
  console.log(`CONSOLE ERRORS (${consoleErrors.length}):`);
  consoleErrors.slice(0, 10).forEach((e) => console.log("  •", e));
} else console.log("No console errors.");
if (failedRequests.length) {
  console.log(`FAILED REQUESTS (${failedRequests.length}):`);
  [...new Set(failedRequests)].slice(0, 10).forEach((e) => console.log("  •", e));
} else console.log("No failed network requests (4xx/5xx).");
if (issues.length) {
  console.log(`PAGE ISSUES (${issues.length}):`);
  issues.forEach((i) => console.log(`  [${i.page}]`, i.problems.join(" | ")));
  process.exitCode = 1;
} else {
  console.log("ALL PAGES OK ✅");
}

chrome.kill();
process.exit(process.exitCode || 0);
