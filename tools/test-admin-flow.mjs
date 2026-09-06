// Full ADMIN UI flow test via headless Chrome + CDP.
// Creates a fresh test admin via the superadmin API, walks every admin page,
// then cleans up. Captures: console errors, failed network requests, DOM checks.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9334;
const BASE = "http://localhost:5173";
const API = "http://localhost:5000/api";
const OUT = "C:/Users/Patrick Zambrano/AppData/Local/Temp";
const SA_EMAIL = "patrickzambrano48@gmail.com";
const SA_PASSWORD = "12345678";
const uniq = Date.now().toString().slice(-7);
const ADMIN_EMAIL = `ui.admin.${uniq}@test.com`;
const ADMIN_PASSWORD = "password123";

// ── setup: create a test admin via the API ────────────────────────────────────
async function apiLogin(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookies = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  return { cookies, data: await res.json() };
}
const sa = await apiLogin(SA_EMAIL, SA_PASSWORD);
if (!sa.data?.userResponse) throw new Error("superadmin API login failed");
const branches = await (await fetch(`${API}/superadmin/branches`, { headers: { Cookie: sa.cookies } })).json();
const branchId = branches.branches?.[0]?._id;
const created = await fetch(`${API}/superadmin/admins`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: sa.cookies },
  body: JSON.stringify({ firstname: "UI", lastname: "Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, assignedBranch: branchId }),
});
const createdData = await created.json();
if (created.status !== 201) throw new Error("test admin create failed: " + JSON.stringify(createdData));
const testAdminProfileId = createdData.data?.id;
console.log("test admin created:", ADMIN_EMAIL, "(profile", testAdminProfileId + ")");

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--user-data-dir=" + OUT + "/cdp-profile-admin",
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
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      consoleErrors.push(msg.params.entry.text.slice(0, 300));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push("EXCEPTION: " + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === "Network.responseReceived") {
      const { status, url } = msg.params.response;
      if (status >= 400 && !url.includes("/auth/login") && !url.includes("/auth/me")) {
        failedRequests.push(`[${status}] ${url.replace(API, "").replace(BASE, "")}`);
      }
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
}

const consoleErrors = [];
const failedRequests = [];

await connect();
await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");

async function nav(url, waitMs = 2200) {
  await send("Page.navigate", { url });
  await sleep(waitMs);
}

async function shot(name) {
  const res = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/adm-${name}.png`, Buffer.from(res.data, "base64"));
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

async function clickButton(text) {
  return evaluate(`(() => {
    const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes(${JSON.stringify(text)}));
    if (b) { b.click(); return true; }
    return false;
  })()`);
}

// Poll body text until it contains `text` (for toasts that auto-dismiss)
async function waitForText(text, tries = 10, step = 500) {
  for (let i = 0; i < tries; i++) {
    await sleep(step);
    const txt = await evaluate(`document.body.innerText`);
    if (txt.includes(text)) return true;
  }
  return false;
}

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
  for (const bad of ["Access denied", "Internal Server Error", "Failed to load", "Failed to create", "Failed to update", "Failed to delete", "Failed to toggle"]) {
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

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Network.clearBrowserCookies");
await send("Runtime.evaluate", { expression: "localStorage.clear()" });

console.log("\n=== 1. LOGIN AS ADMIN ===");
await nav(BASE + "/login");
await sleep(1500);
await shot("login");
await verifyPage("login", "welcome", ["Email", "Password"]);

await setInput('input[type="email"]', ADMIN_EMAIL);
await setInput('input[type="password"]', ADMIN_PASSWORD);
await clickButton("Login");
await sleep(4000);
const url1 = await evaluate("location.pathname");
console.log("  after login pathname:", url1);
if (!url1.includes("dashboard")) {
  const err = await evaluate(`document.body.innerText.slice(0, 200)`);
  issues.push({ page: "login", problems: ["login did not reach /dashboard, pathname=" + url1 + " err=" + err] });
}
await shot("dashboard");
await verifyPage("dashboard", "dashboard", ["Welcome back"]);

// Sidebar: admin must NOT see superadmin links, MUST see admin links + Profile (fix)
const sidebarText = await evaluate(`document.querySelector("aside")?.innerText ?? ""`);
const sidebarProblems = [];
for (const need of ["Products", "Categories", "Riders", "Customers", "Orders", "Profile & Settings"]) {
  if (!sidebarText.includes(need)) sidebarProblems.push(`sidebar missing "${need}"`);
}
for (const banned of ["Branches", "Admins", "Activity Log"]) {
  if (sidebarText.includes(banned)) sidebarProblems.push(`sidebar shows superadmin-only "${banned}"`);
}
if (sidebarProblems.length) {
  issues.push({ page: "sidebar", problems: sidebarProblems });
  console.log("  SIDEBAR ISSUES:", sidebarProblems.join(" | "));
} else {
  console.log("  sidebar OK (admin links + Profile & Settings, no superadmin links)");
}

console.log("\n=== 2. PRODUCTS (CRUD) ===");
await nav(BASE + "/products");
await sleep(2000);
await verifyPage("products", "products", ["Add Product", "Template", "Import Excel"]);
await shot("products");

// Create a product
await clickButton("Add Product");
await sleep(1000);
const prodModalOpen = await evaluate(`!!document.querySelector("form")`);
if (prodModalOpen) {
  await setInput('input[placeholder="SKU"]', `UI${uniq}`);
  await setInput('input[placeholder="Barcode"]', `UIB${uniq}`);
  await setInput('input[placeholder="Product name"]', `UI Test Product ${uniq}`);
  // pick first non-empty category option
  await evaluate(`(() => {
    const sel = document.querySelector("select");
    if (sel && sel.options.length > 1) { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    return sel?.options.length ?? 0;
  })()`);
  // Each number input gets its OWN evaluate call: batching both in one block lets
  // React flush the price state update mid-block and restore the stock input's DOM value.
  await evaluate(`(() => {
    const el = [...document.querySelectorAll('input[type="number"]')][0];
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    s.call(el, "49.5"); el.dispatchEvent(new Event('input', { bubbles: true }));
    return !!el;
  })()`);
  await evaluate(`(() => {
    const el = [...document.querySelectorAll('input[type="number"]')][1];
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    s.call(el, "12"); el.dispatchEvent(new Event('input', { bubbles: true }));
    return !!el;
  })()`);
  await clickButton("Save Product");
  const prodToast = await waitForText("created successfully");
  if (prodToast) console.log("  product created OK (toast seen)");
  else issues.push({ page: "products-create", problems: ["no success toast after product create"] });
  await shot("product-created");

  // cleanup: search for the product (it lands on page 2 of the paginated table),
  // then delete it from the filtered view
  await setInput('input[placeholder*="name or SKU"]', `UI Test Product ${uniq}`);
  await sleep(800);
  await evaluate(`(() => {
    const row = [...document.querySelectorAll("tbody tr")].find(r => r.textContent.includes("UI Test Product"));
    const btn = row && [...row.querySelectorAll("button")].find(b => b.textContent.includes("Delete"));
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(1000);
  // ConfirmDialog confirm button (variant danger, text exactly "Delete")
  await evaluate(`(() => {
    const b = [...document.querySelectorAll("button")].filter(x => x.textContent.trim() === "Delete").pop();
    if (b) b.click();
    return !!b;
  })()`);
  const delToast = await waitForText("deleted successfully");
  console.log("  product cleanup:", delToast ? "done" : "NOT CONFIRMED (check manually)");
  if (!delToast) issues.push({ page: "products-cleanup", problems: ["created product was not deleted"] });
} else {
  issues.push({ page: "products-create", problems: ["Add Product modal did not open"] });
}

console.log("\n=== 3. CATEGORIES (CRUD) ===");
await nav(BASE + "/categories");
await sleep(2000);
await verifyPage("categories", "categories", ["Add Category"]);
await shot("categories");

await clickButton("Add Category");
await sleep(1000);
if (await evaluate(`!!document.querySelector("form")`)) {
  await setInput('input[placeholder="Category name"]', `UI Cat ${uniq}`);
  await clickButton("Save Category");
  const catToast = await waitForText("created successfully");
  if (catToast) console.log("  category created OK (toast seen)");
  else issues.push({ page: "categories-create", problems: ["no success toast after category create"] });
  await shot("category-created");

  // cleanup (search first so the row is on the visible page)
  await setInput('input[placeholder="Search categories..."]', `UI Cat ${uniq}`);
  await sleep(800);
  await evaluate(`(() => {
    const row = [...document.querySelectorAll("tbody tr")].find(r => r.textContent.includes("UI Cat "));
    const btn = row && [...row.querySelectorAll("button")].find(b => b.textContent.includes("Delete"));
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(1000);
  await evaluate(`(() => {
    const b = [...document.querySelectorAll("button")].filter(x => x.textContent.trim() === "Delete").pop();
    if (b) b.click();
    return !!b;
  })()`);
  await waitForText("deleted successfully");
  console.log("  category cleanup done");
}

console.log("\n=== 4. RIDERS ===");
await nav(BASE + "/riders");
await sleep(2000);
await verifyPage("riders", "riders", ["Add Rider"]);
await shot("riders");
// Branch dropdown must have options (uses /admin/branches)
await clickButton("Add Rider");
await sleep(1000);
const riderBranchOptions = await evaluate(`[...document.querySelectorAll("select option")].filter(o => o.value).length`);
console.log("  rider branch dropdown options:", riderBranchOptions);
if (riderBranchOptions === 0) issues.push({ page: "riders", problems: ["branch dropdown has no options"] });
await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Cancel'); if(b) b.click(); })()`);

console.log("\n=== 5. CUSTOMERS ===");
await nav(BASE + "/customers");
await sleep(2000);
await verifyPage("customers", "customers", []);
await shot("customers");
const custRows = await evaluate(`document.querySelectorAll("tbody tr").length`);
console.log("  customer rows:", custRows);
// Toggle the first customer's status and toggle back (verifies isActive now reaches the UI)
if (custRows > 0) {
  await evaluate(`(() => {
    const btn = document.querySelector("tbody tr button");
    if (btn) btn.click();
    return !!btn;
  })()`);
  const toggleToast = await waitForText("toggled");
  if (toggleToast) console.log("  customer status toggle OK");
  else issues.push({ page: "customers", problems: ["status toggle produced no toast"] });
  // toggle back
  await sleep(1500);
  await evaluate(`(() => {
    const btn = document.querySelector("tbody tr button");
    if (btn) btn.click();
    return !!btn;
  })()`);
  await waitForText("toggled");
} else {
  console.log("  (no customers in DB — skipping toggle test)");
}

console.log("\n=== 6. ORDERS ===");
await nav(BASE + "/orders");
await sleep(2000);
await verifyPage("orders", "orders", []);
await shot("orders");
const orderRows = await evaluate(`document.querySelectorAll("tbody tr").length`);
const cancelButtons = await evaluate(`[...document.querySelectorAll("tbody button")].filter(b => b.textContent.includes("Cancel")).length`);
console.log("  order rows:", orderRows, "| cancel buttons:", cancelButtons);
if (orderRows === 0) console.log("  (no orders in DB)");
// Open the first order's detail modal to verify the modal cancel button
if (orderRows > 0) {
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll("tbody button")].find(b => b.textContent.includes("View"));
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(1000);
  const modalHasItems = await evaluate(`document.body.innerText.includes("Order Details")`);
  console.log("  order detail modal open:", modalHasItems);
  await shot("order-modal");
  await evaluate(`(() => {
    const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Close" || x.textContent.trim() === "Cancel" && x.closest('[class*="fixed"]'));
    if (b) b.click();
    return !!b;
  })()`);
}

console.log("\n=== 7. PROFILE ===");
await nav(BASE + "/profile");
await sleep(2000);
await verifyPage("profile", "profile", ["Edit Profile", "Change Password"]);
await shot("profile");
await clickButton("Save Changes");
const profToast = await waitForText("updated successfully");
if (profToast) console.log("  profile save OK");
else issues.push({ page: "profile-save", problems: ["no success toast on profile save"] });

console.log("\n=== 8. HARD RELOAD ON /orders (route guard check) ===");
await evaluate(`location.href = "/orders"`);
await sleep(3000);
const urlReload = await evaluate("location.pathname");
console.log("  after hard reload pathname:", urlReload);
if (!urlReload.includes("orders")) issues.push({ page: "hard-reload", problems: ["/orders bounced to " + urlReload + " after reload"] });

console.log("\n=== 9. LOGOUT ===");
await clickButton("Logout");
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

// ── cleanup: delete the test admin ────────────────────────────────────────────
const del = await fetch(`${API}/superadmin/admins/${testAdminProfileId}`, { method: "DELETE", headers: { Cookie: sa.cookies } });
console.log("cleanup test admin:", del.status, (await del.json()).message ?? "");
process.exit(process.exitCode || 0);
