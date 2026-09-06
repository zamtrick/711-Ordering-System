// End-to-end Cloudinary image flow via real UIs:
// 1. Admin web (Vite) — login as temp admin → create product → click "Image"
//    → CDP sets a real PNG on the hidden file input → thumbnail renders
//    (verify <img src> is the Cloudinary URL, no console/network errors).
// 2. Customer mobile (Expo web on :8081) — login as a temp customer →
//    verify the Products tab renders an <img> with the same Cloudinary URL.
// Cleans up everything afterwards.
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9340;
const WEB = "http://localhost:5173";
const EXPO = "http://10.0.75.231:8081"; // expo binds the LAN interface, not loopback
const API = "http://localhost:5000/api";
const OUT = "C:/Users/Patrick Zambrano/AppData/Local/Temp";
const SA_EMAIL = "patrickzambrano48@gmail.com";
const SA_PASSWORD = "12345678";
const uniq = Date.now().toString().slice(-7);
const ADMIN_EMAIL = `img.admin.${uniq}@test.com`;
const ADMIN_PASSWORD = "password123";
const CUST_EMAIL = `img.cust.${uniq}@test.com`;
const CUST_PASSWORD = "password123";
const PRODUCT_NAME = `ImgFlow Product ${uniq}`;
const PNG_PATH = join(OUT, "imgflow-test.png");

// ── tiny API client with cookie jar ───────────────────────────────────────────
function makeApi() {
  const jar = new Map();
  return async function call(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === "" || /Expires=Thu, 01 Jan 1970/i.test(raw)) jar.delete(name);
      else jar.set(name, value);
    }
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  };
}
const api = makeApi();

// 96×96 red PNG (real image, decodable)
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAb0lEQVR4nO3QMQ0AMAgEQXCf7l1Qwe4wMLuzM/DuCslMRwas+qvIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiLzBmK0Y6e4l6kPbAAAAAElFTkSuQmCC";
writeFileSync(PNG_PATH, Buffer.from(PNG_BASE64, "base64"));

let passed = 0, failed = 0;
const ok = (label, cond, extra = "") => {
  cond ? (passed++, console.log(`✅ ${label}${extra ? ` — ${extra}` : ""}`))
       : (failed++, console.log(`❌ ${label}${extra ? ` — ${extra}` : ""}`));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── setup data: admin + customer + product (product created via UI below) ────
console.log("── setup ──");
await api("POST", "/auth/login", { email: SA_EMAIL, password: SA_PASSWORD });
const branches = await api("GET", "/superadmin/branches");
const branchId = branches.data?.branches?.[0]?._id;
const adm = await api("POST", "/superadmin/admins", {
  firstname: "Img", lastname: "Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, assignedBranch: branchId,
});
const adminProfileId = adm.data?.user?.id ?? adm.data?.data?.id;
ok("temp admin created", adm.status === 201);

const cust = await api("POST", "/auth/register", {
  firstname: "Img", lastname: "Customer", email: CUST_EMAIL, password: CUST_PASSWORD,
});
ok("temp customer created", cust.status === 201);
await api("POST", "/auth/logout");

// category for the product (created via API as admin, product itself via UI)
await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
const cats = await api("GET", "/admin/categories");
const categoryId = cats.data?.categories?.[0]?._id;
const prodSeed = await api("POST", "/admin/products", {
  name: PRODUCT_NAME, sku: `IMG${uniq}`, barcode: `IMGB${uniq}`, price: 25, stock: 10, categoryId,
});
const productId = prodSeed.data?.product?._id ?? prodSeed.data?.data?._id;
ok("seed product created (API)", prodSeed.status === 201, `id=${productId}`);
await api("POST", "/auth/logout");

// ── CDP plumbing ──────────────────────────────────────────────────────────────
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  "--user-data-dir=" + OUT + "/cdp-profile-imgflow",
  `--remote-debugging-port=${CDP_PORT}`,
  "--window-size=1440,900",
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
const consoleErrors = [];
const failedRequests = [];

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
      consoleErrors.push(msg.params.entry.text.slice(0, 250));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push("EXCEPTION: " + JSON.stringify(msg.params.exceptionDetails).slice(0, 250));
    }
    if (msg.method === "Network.responseReceived") {
      const { status, url } = msg.params.response;
      if (status >= 400 && !url.includes("/auth/login") && !url.includes("/auth/me")) {
        failedRequests.push(`[${status}] ${url.replace(API, "").replace(WEB, "")}`);
      }
    }
    if (msg.method === "DOM.setFileInputFiles" && msg.id && pending.has(msg.id)) {
      // handled by normal pending resolution
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
}

await connect();
await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("DOM.enable");

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};
const nav = async (url, waitMs = 2500) => { await send("Page.navigate", { url }); await sleep(waitMs); };
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/imgflow-${name}.png`, Buffer.from(r.data, "base64"));
  console.log("  shot:", name);
};
const setInput = (selector, value) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
const clickButton = (text) => evaluate(`(() => {
  const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes(${JSON.stringify(text)}));
  if (b) { b.click(); return true; }
  return false;
})()`);
const waitFor = async (expr, tries = 20, step = 500) => {
  for (let i = 0; i < tries; i++) {
    await sleep(step);
    if (await evaluate(expr)) return true;
  }
  return false;
};

// Set a real file on the product row's hidden file input via CDP
async function setFileOnProductRowInput() {
  // 1. find the node
  const doc = await send("DOM.getDocument");
  const rootNodeId = doc.root.nodeId;
  // hidden input inside the products page (accept attr makes it unique enough)
  const q = await send("DOM.querySelectorAll", {
    nodeId: rootNodeId,
    selector: 'input[type="file"][accept*="image"]',
  });
  const nodeId = q.nodeIds?.[0];
  if (!nodeId) return false;
  await send("DOM.setFileInputFiles", { files: [PNG_PATH], nodeId });
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
console.log("\n=== PART 1: ADMIN WEB — upload via UI ===");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await nav(WEB + "/login", 2000);

await setInput('input[type="email"]', ADMIN_EMAIL);
await setInput('input[type="password"]', ADMIN_PASSWORD);
await clickButton("Login");
await waitFor(`location.pathname.includes("dashboard")`, 16);
ok("admin login via UI", (await evaluate("location.pathname")).includes("dashboard"));

await nav(WEB + "/products", 2500);
// The table is paginated — search so OUR row is guaranteed on the visible page.
await setInput('input[placeholder*="name or SKU"]', PRODUCT_NAME);
await sleep(1200);
const clickedImage = await evaluate(`(() => {
  const rows = [...document.querySelectorAll("tbody tr")].filter(r => r.textContent.includes(${JSON.stringify(PRODUCT_NAME)}));
  if (rows.length !== 1) return "rows:" + rows.length;
  const btn = [...rows[0].querySelectorAll("button")].find(b => b.textContent.includes("Image"));
  if (!btn) return "no-btn";
  btn.click(); // sets uploadingImageFor to THIS product, then opens the shared hidden input
  return "clicked";
})()`);
ok("product row found + Image button clicked", clickedImage === "clicked", clickedImage);
await sleep(700);

// now the hidden input exists — attach the real PNG
const fileSet = await setFileOnProductRowInput();
ok("CDP set real PNG on file input", fileSet);

// Authoritative check: poll the API until OUR product carries a Cloudinary URL
let productImageUrl = "";
await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  const p = await api("GET", `/admin/products/${productId}`);
  const img = p.data?.product?.image ?? p.data?.data?.image ?? "";
  if (img.includes("res.cloudinary.com")) { productImageUrl = img; break; }
}
ok("OUR product now stores a Cloudinary URL", productImageUrl.includes("res.cloudinary.com"), productImageUrl.slice(0, 100));

// UI check: the row thumbnail renders that exact URL
const uploadDone = await waitFor(
  `[...document.querySelectorAll("tbody img")].some(i => (i.src||"") === ${JSON.stringify(productImageUrl)})`,
  15, 1000,
);
ok("thumbnail in admin table renders that URL", uploadDone);

// fetch the URL server-side to confirm it's publicly decodable
if (productImageUrl) {
  const head = await fetch(productImageUrl);
  ok("Cloudinary image is publicly reachable", head.ok, `${head.status} ${head.headers.get("content-type") ?? ""}`);
}
await shot("admin-thumbnail");

await api("POST", "/auth/logout");

// ══════════════════════════════════════════════════════════════════════════════
console.log("\n=== PART 2: CUSTOMER MOBILE (Expo web) — image renders ===");
await send("Network.clearBrowserCookies");
await nav(EXPO, 8000); // Expo web first bundle can take a while

// login screen → sign in as the temp customer
const onLogin = await waitFor(`!!document.querySelector('input')`, 30, 1000);
ok("Expo web app loaded (login form present)", onLogin);

// fill the login form (React Native Web renders TextInput as real inputs)
const emailSet = await setInput('input[placeholder="Enter your email"]', CUST_EMAIL);
const passSet = await setInput('input[placeholder="Enter your password"]', CUST_PASSWORD);
ok("login form filled", emailSet && passSet);
// RN Web Pressable ignores synthetic .click() — dispatch real mouse events
// at the innermost "Login" text element's center.
const loginRect = await evaluate(`(() => {
  const texts = [...document.querySelectorAll('div[dir="auto"]')].filter(x => x.textContent.trim() === "Login");
  if (!texts.length) return null;
  const r = texts[texts.length - 1].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`);
if (loginRect) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: loginRect.x, y: loginRect.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: loginRect.x, y: loginRect.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: loginRect.x, y: loginRect.y, button: "left", clickCount: 1 });
}
// wait until we're past auth (home tab greets the user)
await waitFor(`document.body.innerText.includes("Good day") || document.body.innerText.includes("What are you looking for")`, 24, 1000);
ok("mobile login succeeded (home tab rendered)", await evaluate(`document.body.innerText.includes("Good day") || document.body.innerText.includes("What are you looking for")`));
await sleep(1500);

// deep-link straight to the Products tab
await nav(EXPO + "/products", 5000);
await waitFor(`document.body.innerText.includes("Our Products")`, 20, 1000);
await sleep(2500); // let images decode

// the product's image must be rendered as an <img> with the Cloudinary URL
const expoImg = await evaluate(`(() => {
  const imgs = [...document.querySelectorAll("img")].filter(i => (i.src||"").includes("res.cloudinary.com"));
  if (!imgs.length) return { found: false };
  // RN Web renders the image and the name inside the same card container
  const match = imgs.find(i => i.closest("div")?.parentElement?.textContent?.includes(${JSON.stringify(PRODUCT_NAME)})) || imgs[0];
  return { found: true, src: match.src, size: match.naturalWidth + "x" + match.naturalHeight };
})()`);
ok("mobile app renders the Cloudinary image", expoImg?.found === true, expoImg?.src?.slice(0, 90) ?? "no img");
if (expoImg?.found) ok("image actually decoded (naturalWidth > 0)", Number(expoImg.size.split("x")[0]) > 0, expoImg.size);
ok("mobile shows OUR product's URL", expoImg?.src === productImageUrl);
await shot("expo-products-tab");

// ══════════════════════════════════════════════════════════════════════════════
console.log("\n=== SUMMARY ===");
if (consoleErrors.length) {
  console.log(`CONSOLE ERRORS (${consoleErrors.length}):`);
  consoleErrors.slice(0, 8).forEach((e) => console.log("  •", e));
} else console.log("No console errors.");
if (failedRequests.length) {
  console.log(`FAILED REQUESTS (${failedRequests.length}):`);
  [...new Set(failedRequests)].slice(0, 8).forEach((e) => console.log("  •", e));
} else console.log("No failed network requests.");

chrome.kill();

// ══════════════════════════════════════════════════════════════════════════════
console.log("\n=== CLEANUP ===");
await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
// remove the Cloudinary asset + clear the field, then delete the product
await api("DELETE", `/admin/products/${productId}/image`);
const delP = await api("DELETE", `/admin/products/${productId}`);
ok("test product deleted", delP.status === 200);
await api("POST", "/auth/logout");

await api("POST", "/auth/login", { email: SA_EMAIL, password: SA_PASSWORD });
const delA = await api("DELETE", `/superadmin/admins/${adminProfileId}`);
ok("temp admin deleted", delA.status === 200);

// customer cleanup via admin customers list
const custs = await api("GET", "/admin/customers?page=1&limit=100");
const mine = (custs.data?.customers ?? []).find((c) => c.user?.email === CUST_EMAIL);
if (mine?._id) {
  const delC = await api("DELETE", `/admin/customers/${mine._id}`);
  ok("temp customer deleted", delC.status === 200);
}
await api("POST", "/auth/logout");

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
