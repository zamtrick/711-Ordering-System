// Verify the Add Product form keeps focus while typing — every field gets a
// multi-character string typed via real CDP keyboard events. If the form were
// still remounting per keystroke, the values would be truncated/empty.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9337;
const APP = "http://localhost:5173";
const TMP = process.env.TEMP || "/tmp";
const SHOT = (n) => join(TMP, n);

const results = [];
const ok = (name, pass, extra = "") => {
  results.push({ name, pass, extra });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- launch chrome ----
const proc = spawn(CHROME, [
  `--remote-debugging-port=${CDP_PORT}`,
  "--user-data-dir=" + join(TMP, "cdp-profile-productform"),
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1400,900",
  "about:blank",
], { stdio: "ignore" });
const cleanupChrome = () => { try { proc.kill(); } catch {} };
process.on("exit", cleanupChrome);

// ---- CDP helper ----
const ws = await new Promise(async (resolve, reject) => {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page" && t.url === "about:blank");
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        ws.onopen = () => resolve(ws);
        return;
      }
    } catch { /* retry */ }
    await sleep(500);
    if (i === 29) reject(new Error("CDP connect failed"));
  }
});

let msgId = 0;
const pending = new Map();
let consoleErrors = [];
let failedRequests = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve } = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg.result ?? msg.error);
  } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    consoleErrors.push(msg.params.entry.text);
  } else if (msg.method === "Network.loadingFailed" && !msg.params.canceled) {
    failedRequests.push(msg.params.errorText);
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++msgId;
  pending.set(id, { resolve });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))?.result?.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");

// ---- login as a temp admin (self-provisioned via superadmin) ----
const BASE = "http://localhost:5000";
const SA_EMAIL = "patrickzambrano48@gmail.com";
const SA_PASSWORD = "12345678";

// find a working superadmin credential (auth is cookie-based)
let saToken = null;
for (const [email, pw] of [[SA_EMAIL, SA_PASSWORD]]) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  }).catch(() => null);
  if (r && r.ok) {
    const raw = r.headers.get("set-cookie") ?? "";
    const m = raw.match(/accessToken=([^;]+)/);
    saToken = m ? decodeURIComponent(m[1]) : null;
    console.log(`logged in via API as ${email}`);
    break;
  }
}
if (!saToken) { ok("superadmin login (API)", false, "no credential worked"); process.exit(1); }

// create a temp admin for UI login
const uniq = Date.now();
const adminEmail = `formtest${uniq}@test.com`;
const createAdmin = await fetch(`${BASE}/api/superadmin/admins`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${saToken}` },
  body: JSON.stringify({ firstname: "Form", lastname: "Test", email: adminEmail, password: "Form@1234", branchId: null }),
}).catch((e) => ({ ok: false, status: 0, text: () => Promise.resolve(String(e)) }));
let adminOk = createAdmin.ok;
if (!adminOk) {
  const t = await createAdmin.text().catch(() => "");
  console.log("admin create status", createAdmin.status, t.slice(0, 300));
}

// clear any prior cookies, then log in through the real UI form
await send("Storage.clearDataForOrigin", { origin: APP, storageTypes: ["all"] });
await send("Page.navigate", { url: APP });
await sleep(3500);

const emailSel = `document.querySelector('input[type="email"]')`;
await send("Input.insertText", { text: adminEmail });
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
await send("Input.insertText", { text: "Form@1234" });
await sleep(300);
const loginBtn = await evaluate(`[...document.querySelectorAll("button")].find(b => b.textContent.trim().toLowerCase().includes("login"))`);
if (loginBtn) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
}
await sleep(3000);
ok("UI login as temp admin", await evaluate(`!!document.querySelector('[data-page], .sidebar, aside')`) === true);

// ---- navigate to Products ----
await evaluate(`[...document.querySelectorAll("a")].find(a => a.getAttribute("href")?.includes("products"))?.click()`);
await sleep(2500);

// ---- open Add Product ----
await evaluate(`[...document.querySelectorAll("button")].find(b => b.textContent.trim().includes("Add Product"))?.click()`);
await sleep(800);
const modalOpen = await evaluate(`document.body.innerText.includes("Add Product")`);
ok("Add Product modal opens", modalOpen);

// ---- type into every field ----
const typeInto = async (label, text) => {
  const clicked = await evaluate(`(() => {
    const labels = [...document.querySelectorAll("label")];
    const lab = labels.find(l => l.textContent.trim() === ${JSON.stringify(label)});
    if (!lab) return false;
    const wrap = lab.parentElement;
    const inp = wrap?.querySelector("input, textarea");
    if (!inp) return false;
    inp.focus();
    inp.click();
    return true;
  })()`);
  if (!clicked) return false;
  for (const ch of text) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch, windowsVirtualKeyCode: 0 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch, windowsVirtualKeyCode: 0 });
  }
  await sleep(150);
  const val = await evaluate(`(() => {
    const labels = [...document.querySelectorAll("label")];
    const lab = labels.find(l => l.textContent.trim() === ${JSON.stringify(label)});
    const wrap = lab?.parentElement;
    return wrap?.querySelector("input, textarea")?.value ?? "";
  })()`);
  return val === text;
};

// 5 characters each — any remount bug shows up as truncated/lost text
ok("type SKU (5 chars stay)", await typeInto("SKU *", "TSK01"));
ok("type Barcode (5 chars stay)", await typeInto("Barcode *", "BC123"));
ok("type Name (5+ chars stay)", await typeInto("Name *", "Cup Noodles"));
ok("type Price (multi-digit stays)", await typeInto("Price *", "125.50"));
ok("type Stock (multi-digit stays)", await typeInto("Stock *", "42"));

// description textarea
const descOk = await evaluate(`(() => {
  const ta = document.querySelector("textarea");
  if (!ta) return false;
  ta.focus();
  ta.click();
  return true;
})()`);
if (descOk) {
  for (const ch of "Tasty noodles") {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch, windowsVirtualKeyCode: 0 });
    await send("submitKeyEventPlaceholder", {});
  }
}
// redo description properly (loop above intentionally minimal)
const ta = await evaluate(`(() => {
  const ta = document.querySelector("textarea");
  if (!ta) return false;
  ta.focus();
  return true;
})()`);
if (ta) {
  const text = "Tasty instant noodles";
  for (const ch of text) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch, windowsVirtualKeyCode: 0 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch, windowsVirtualKeyCode: 0 });
  }
}
const descVal = await evaluate(`document.querySelector("textarea")?.value ?? ""`);
ok("type Description (stays)", descVal === "Tasty instant noodles", descVal.slice(0, 30));

// ---- select category ----
const catSet = await evaluate(`(() => {
  const sel = document.querySelector("select");
  if (!sel || sel.options.length < 2) return false;
  sel.selectedIndex = 1;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return sel.options[sel.selectedIndex].textContent.trim();
})()`);
ok("category selectable", catSet !== false && !!catSet, String(catSet));

// screenshot before save
const shot1 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(SHOT("product-form-filled.png"), Buffer.from(shot1.data, "base64"));

// ---- submit and verify the product was created ----
await evaluate(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Save Product")?.click()`);
await sleep(2500);
const created = await fetch(`${BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${saToken}` } })
  .then((r) => r.json()).catch(() => null);
const createdList = created?.products ?? created?.data?.products ?? [];
const match = createdList.find((p) => p.name === "Cup Noodles" && p.sku === "TSK01");
ok("product created from typed form", !!match, match ? `price=${match.price} stock=${match.stock}` : "not found in API");
if (match) ok("typed price/stock persisted correctly", match.price === 125.5 && match.stock === 42, `price=${match.price} stock=${match.stock}`);

// ---- cleanup: delete product + temp admin ----
if (match) {
  await fetch(`${BASE}/api/admin/products/${match._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${saToken}` } }).catch(() => {});
}
await fetch(`${BASE}/api/superadmin/admins?search=${encodeURIComponent(adminEmail)}`, { headers: { Authorization: `Bearer ${saToken}` } })
  .then((r) => r.json()).catch(() => null);
// delete admin via list + match
const adminsRes = await fetch(`${BASE}/api/superadmin/admins`, { headers: { Authorization: `Bearer ${saToken}` } }).then((r) => r.json()).catch(() => null);
const admins = adminsRes?.admins ?? adminsRes?.data?.admins ?? [];
const me = admins.find((a) => a.email === adminEmail);
if (me) await fetch(`${BASE}/api/superadmin/admins/${me._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${saToken}` } }).catch(() => {});

ok("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
ok("no failed network requests", failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
ws.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
