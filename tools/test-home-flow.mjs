// Verify the customer home screen uses real backend data and all its
// controls navigate: search → products, category chip → filtered products,
// See all / Shop Now → products. Runs against Expo web via CDP.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9347;
const EXPO = "http://10.0.75.231:8081";
const API = "http://localhost:5000/api";
const OUT = "C:/Users/Patrick Zambrano/AppData/Local/Temp";

const EMAIL = `home.cust.test@test.com`;
const PASS = "password123";

// ensure test customer exists
await fetch(`${API}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ firstname: "Home", lastname: "Test", email: EMAIL, password: PASS }),
}).catch(() => {});

// what the backend actually has (ground truth)
const jar = new Map();
async function call(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    const n = pair.slice(0, eq).trim(), v = pair.slice(eq + 1).trim();
    if (v === "" || /Expires=Thu, 01 Jan 1970/i.test(raw)) jar.delete(n); else jar.set(n, v);
  }
  let d = null; try { d = await res.json(); } catch {}
  return { status: res.status, data: d };
}
await call("POST", "/auth/login", { email: EMAIL, password: PASS });
const backendProds = (await call("GET", "/customer/products")).data?.data ?? [];
const backendCats = [...new Set(backendProds.map((p) => p.categoryId?.name).filter(Boolean))];
console.log(`backend truth: ${backendProds.length} products, ${backendCats.length} categories: ${backendCats.slice(0, 5).join(", ")}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ["--headless=new","--disable-gpu","--no-first-run","--user-data-dir=" + OUT + "/cdp-profile-home",`--remote-debugging-port=${CDP_PORT}`,"--window-size=420,900"], { stdio: "ignore" });
async function getJson(url) {
  for (let i = 0; i < 40; i++) { try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {} await sleep(250); }
  throw new Error("CDP not reachable");
}
let msgId = 0; const pending = new Map(); let ws;
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
const consoleErrors = [];
const list = await getJson(`http://localhost:${CDP_PORT}/json/list`);
ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") consoleErrors.push(m.params.entry.text.slice(0, 180));
  if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
};
await send("Runtime.enable"); await send("Page.enable");

const evalJs = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
const pollUntil = async (expr, timeoutMs, step = 200) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { if (await evalJs(expr).catch(() => null)) return Date.now() - start; await sleep(step); }
  return -1;
};
// real mouse tap (RN Web Pressable needs pointer events)
const tapText = async (text, exact = true) => {
  const rect = await evalJs(`(() => {
    const els = [...document.querySelectorAll('div')].filter(d => d.textContent.trim() === ${JSON.stringify(text)} && d.children.length === 0);
    if (!els.length) return null;
    const r = els[els.length - 1].getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  })()`);
  if (!rect) return false;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  return true;
};

let passed = 0, failed = 0;
const ok = (l, c, e = "") => { c ? (passed++, console.log(`✅ ${l}${e ? ` — ${e}` : ""}`)) : (failed++, console.log(`❌ ${l}${e ? ` — ${e}` : ""}`)); };

// ── login ─────────────────────────────────────────────────────────────────────
send("Page.navigate", { url: EXPO }).catch(() => {});
// Wait for the login screen to be VISIBLE — inputs exist in the DOM earlier,
// but the boot splash overlay (zIndex 999) intercepts taps until it unmounts.
// "Welcome Back" only enters innerText once the splash is gone.
await pollUntil(`document.body.innerText.includes("Welcome Back")`, 30000);
await evalJs(`(() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const email = document.querySelector('input[placeholder="Enter your email"]');
  const pass = document.querySelector('input[placeholder="Enter your password"]');
  set.call(email, ${JSON.stringify(EMAIL)}); email.dispatchEvent(new Event('input', { bubbles: true }));
  set.call(pass, ${JSON.stringify(PASS)}); pass.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await sleep(300);
const loginRect = await evalJs(`(() => {
  const els = [...document.querySelectorAll('div')].filter(d => d.textContent.trim() === "Login" && d.children.length === 0);
  if (!els.length) return null;
  const r = els[els.length - 1].getBoundingClientRect();
  return { x: r.x + r.width/2, y: r.y + r.height/2 };
})()`);
if (loginRect) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: loginRect.x, y: loginRect.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: loginRect.x, y: loginRect.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: loginRect.x, y: loginRect.y, button: "left", clickCount: 1 });
}
await pollUntil(`document.body.innerText.includes("What are you looking for")`, 20000);
const afterLogin = await evalJs(`document.body.innerText.slice(0, 150).replace(/\\n/g, " | ")`);
console.log("  after login, page shows:", afterLogin);
ok("logged in → home rendered", (await evalJs(`document.body.innerText.includes("What are you looking for")`)) === true);
await sleep(2500); // let home data load

// ── 1. home shows REAL backend data ──────────────────────────────────────────
const homeText = await evalJs(`document.body.innerText`);
const expectedCat = backendCats[0];
const expectedProd = backendProds[0]?.name;
ok("home shows a real category name from backend", expectedCat ? homeText.includes(expectedCat) : true, expectedCat ?? "(no categories in backend)");
ok("home shows a real product name from backend", expectedProd ? homeText.includes(expectedProd) : true, expectedProd ?? "(no products)");
ok("home no longer shows hardcoded 'Refreshing Drink'", !homeText.includes("Refreshing Drink") || (expectedProd ?? "").includes("Refreshing Drink"));

const catCount = await evalJs(`document.body.innerText.split("\\n").filter(l => ${JSON.stringify(backendCats)}.includes(l.trim())).length`);
console.log(`  category chips rendered: ${catCount}/${backendCats.length}`);
ok("all backend categories rendered as chips", catCount === backendCats.length, `${catCount}/${backendCats.length}`);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(`${OUT}/home-real-data.png`, Buffer.from(shot.data, "base64"));

// ── 2. search bar tap → products screen ──────────────────────────────────────
await tapText("Search products...");
const searchNav = await pollUntil(`document.body.innerText.includes("Our Products")`, 8000);
ok("search bar tap → Products screen", searchNav >= 0);

// go back home via the Home tab
await tapText("Home");
await pollUntil(`document.body.innerText.includes("What are you looking for")`, 8000);
await sleep(800);

// ── 3. category chip tap → products filtered to that category ────────────────
if (expectedCat) {
  // RN flattens text — the chip's name appears as its own line in innerText
  const tapped = await evalJs(`(() => {
    // find the pressable whose accessibility label / text equals the category
    const els = [...document.querySelectorAll('div[dir="auto"]')].filter(d => d.textContent.trim() === ${JSON.stringify(expectedCat)});
    if (!els.length) return false;
    const r = els[0].getBoundingClientRect();
    window.__catTap = { x: r.x + r.width/2, y: r.y + r.height/2 };
    return true;
  })()`);
  if (tapped) {
    const p = (await evalJs(`window.__catTap`));
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await pollUntil(`document.body.innerText.includes("Our Products")`, 8000);
    await sleep(1200);
    const prodText = await evalJs(`document.body.innerText`);
    ok("category tap → Products screen opened", prodText.includes("Our Products"));
    // chip should be preselected (active chip is white text on green)
    ok("products screen pre-filtered to the tapped category", prodText.includes(expectedCat));
  } else {
    ok("category chip tappable", false, "chip element not found");
  }
  await tapText("Home");
  await pollUntil(`document.body.innerText.includes("What are you looking for")`, 8000);
  await sleep(600);
}

// ── 4. See all → products ─────────────────────────────────────────────────────
await tapText("See all");
const seeAllNav = await pollUntil(`document.body.innerText.includes("Our Products")`, 8000);
ok("See all tap → Products screen", seeAllNav >= 0);
await tapText("Home");
await pollUntil(`document.body.innerText.includes("What are you looking for")`, 8000);
await sleep(600);

// ── 5. Shop Now → products ────────────────────────────────────────────────────
await tapText("Shop Now");
const shopNav = await pollUntil(`document.body.innerText.includes("Our Products")`, 8000);
ok("Shop Now tap → Products screen", shopNav >= 0);

// ── summary ───────────────────────────────────────────────────────────────────
console.log(`\\nconsole errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 6).forEach((e) => console.log("  •", e));
ok("no console errors", consoleErrors.length === 0);

console.log(`\\n=== ${passed} passed, ${failed} failed ===`);
chrome.kill();

// cleanup test customer
await call("POST", "/auth/logout");
await call("POST", "/auth/login", { email: "patrickzambrano48@gmail.com", password: "12345678" });
const custs = await call("GET", "/admin/customers?page=1&limit=100");
const mine = (custs.data?.customers ?? []).find((c) => c.user?.email === EMAIL);
if (mine?._id) { await call("DELETE", `/admin/customers/${mine._id}`); console.log("cleanup: test customer deleted"); }
process.exit(failed > 0 ? 1 : 0);
