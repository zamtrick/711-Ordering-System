// Live verification of Cloudinary product-image upload:
// superadmin → temp admin → create product → upload PNG → check Cloudinary URL
// → remove image → cleanup. Run while the dev server is up.
import { fileURLToPath } from "node:url";

const B = "http://localhost:5000/api";
const SA_EMAIL = "patrickzambrano48@gmail.com";
const SA_PASS = "12345678";

// 1x1 red PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const jar = new Map();
async function call(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(B + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value === "" || /Expires=Thu, 01 Jan 1970/i.test(raw)) jar.delete(name);
    else jar.set(name, value);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;
const ok = (label, cond, extra = "") => {
  cond ? (passed++, console.log(`✅ ${label}${extra ? ` — ${extra}` : ""}`))
       : (failed++, console.log(`❌ ${label}${extra ? ` — ${extra}` : ""}`));
};

// ── setup: superadmin + temp admin ─────────────────────────────
await call("POST", "/auth/login", { email: SA_EMAIL, password: SA_PASS });
const branches = await call("GET", "/superadmin/branches");
const branchId = branches.data?.branches?.[0]?._id;
const stamp = Date.now().toString().slice(-6);
const created = await call("POST", "/superadmin/admins", {
  firstname: "Cloud",
  lastname: "Test",
  email: `cloudtest${stamp}@test.com`,
  password: "password123",
  assignedBranch: branchId,
});
const adminUserId = created.data?.user?.id ?? created.data?.data?.id;
ok("create temp admin", created.status === 201);
await call("POST", "/auth/logout");

// ── login as admin ─────────────────────────────────────────────
const l = await call("POST", "/auth/login", {
  email: `cloudtest${stamp}@test.com`,
  password: "password123",
});
ok("login as temp admin", l.status === 200);

// ── categories for product ─────────────────────────────────────
const cats = await call("GET", "/admin/categories");
const categoryId = cats.data?.categories?.[0]?._id;
ok("get a category", Boolean(categoryId));

// ── create product ─────────────────────────────────────────────
const prod = await call("POST", "/admin/products", {
  name: `Cloudinary Test ${stamp}`,
  sku: `CLD${stamp}`,
  barcode: `BC${stamp}`,
  price: 10,
  stock: 5,
  categoryId,
});
const productId = prod.data?.product?._id ?? prod.data?.data?._id;
ok("create test product", prod.status === 201, `id=${productId}`);

// ── upload the PNG ─────────────────────────────────────────────
const tmp = new URL("./tmp-test-image.png", import.meta.url);
const { writeFileSync, readFileSync, unlinkSync } = await import("node:fs");
writeFileSync(fileURLToPath(tmp), Buffer.from(PNG_BASE64, "base64"));

const form = new FormData();
const blob = new Blob([readFileSync(fileURLToPath(tmp))], { type: "image/png" });
form.append("image", blob, "test.png");

const upRes = await fetch(`${B}/admin/products/${productId}/image`, {
  method: "POST",
  headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
  body: form,
});
const up = await upRes.json();
ok(
  "POST /:id/image → 200",
  upRes.status === 200,
  upRes.status !== 200 ? JSON.stringify(up).slice(0, 200) : "",
);

const imageUrl = up.product?.image ?? up.data?.image;
ok(
  "stored image is a Cloudinary URL",
  typeof imageUrl === "string" && imageUrl.startsWith("https://res.cloudinary.com/"),
  imageUrl?.slice(0, 90),
);

// ── confirm the URL is publicly fetchable ──────────────────────
const imgFetch = await fetch(imageUrl);
ok("Cloudinary URL is reachable", imgFetch.ok, `${imgFetch.status} ${imgFetch.headers.get("content-type") ?? ""}`);

// ── customer-facing products list shows the same URL ───────────
await call("POST", "/auth/logout");
await call("POST", "/auth/login", { email: SA_EMAIL, password: SA_PASS });
const custProds = await call("GET", "/admin/products?search=" + encodeURIComponent(`Cloudinary Test ${stamp}`));
const found = (custProds.data?.products ?? []).find((p) => p._id === productId);
ok(
  "product list reflects Cloudinary image",
  found?.image === imageUrl,
  found?.image?.slice(0, 60),
);

// ── delete the image (should destroy on Cloudinary) ────────────
const del = await call("DELETE", `/admin/products/${productId}/image`);
ok("DELETE /:id/image → 200", del.status === 200, `image now: ${JSON.stringify(del.data?.product?.image ?? del.data?.data?.image)}`);

// ── cleanup ────────────────────────────────────────────────────
const delProd = await call("DELETE", `/admin/products/${productId}`);
ok("delete test product", delProd.status === 200);

// still logged in as superadmin here — delete the temp admin first, then logout
const delAdmin = await call("DELETE", `/superadmin/admins/${adminUserId}`);
ok("cleanup temp admin", delAdmin.status === 200, `got ${delAdmin.status}`);
await call("POST", "/auth/logout");

try {
  unlinkSync(fileURLToPath(tmp));
} catch {}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
