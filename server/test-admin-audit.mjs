// ============================================================
// ADMIN ROLE — FULL API AUDIT
// Tests every admin endpoint end-to-end against the live DB.
// Focus: correct status codes (no 500 for user errors), CRUD flows.
// ============================================================
const BASE = "http://localhost:5000/api";
const c = {};

function extractCookies(res) {
  (res.headers.getSetCookie?.() || []).forEach((cookie) => {
    const [kv] = cookie.split(";");
    const [k, v] = kv.split("=");
    if (k && v) c[k.trim()] = v.trim();
  });
}
const cookieHeader = () => Object.entries(c).map(([k, v]) => `${k}=${v}`).join("; ");

async function req(method, path, body, label, expect) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  extractCookies(res);
  let data = {};
  try { data = await res.json(); } catch {}
  const ok = expect ? expect.includes(res.status) : res.status >= 200 && res.status < 300;
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} [${res.status}] ${label}${expect ? ` (expect ${expect.join("/")})` : ""}: ${JSON.stringify(data).slice(0, 110)}`);
  if (!ok) FAILURES.push(`${label} → got ${res.status}, expected ${expect ? expect.join("/") : "2xx"}`);
  return { status: res.status, data };
}
async function get(path, label, expect) { return req("GET", path, undefined, label, expect); }
async function post(path, body, label, expect) { return req("POST", path, body, label, expect); }
async function patch(path, body, label, expect) { return req("PATCH", path, body, label, expect); }
async function del(path, label, expect) { return req("DELETE", path, undefined, label, expect); }

const FAILURES = [];
const uniq = Date.now().toString().slice(-7);

// ============================================================
async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  ADMIN ROLE — FULL API AUDIT");
  console.log("═══════════════════════════════════════════════\n");

  // ── SETUP: superadmin creates a fresh test admin ─────
  console.log("── SETUP (superadmin creates test admin) ─────");
  const saLogin = await req("POST", "/auth/login", { email: "patrickzambrano48@gmail.com", password: "12345678" }, "Superadmin login");
  if (saLogin.status !== 200) { console.log("\n❌ Cannot proceed without superadmin login."); process.exit(1); }
  const branchList0 = await get("/superadmin/branches", "GET branches (for assignedBranch)");
  const branchForAdmin = branchList0.data?.branches?.[0]?._id;
  if (!branchForAdmin) { console.log("\n❌ No branch available to assign the test admin to."); process.exit(1); }
  const testAdminEmail = `audit.admin.${uniq}@test.com`;
  const created = await post("/superadmin/admins", {
    firstname: "Audit", lastname: "Admin", email: testAdminEmail, password: "password123", assignedBranch: branchForAdmin,
  }, "CREATE test admin (via superadmin)");
  const testAdminUserId = created.data?.data?.user?.id;
  const testAdminProfileId = created.data?.data?.id; // Admin profile id — what DELETE expects

  // Clear cookies so we log in as the new admin only
  Object.keys(c).forEach((k) => delete c[k]);

  // ── AUTH ──────────────────────────────────────────────
  console.log("\n── AUTH ──────────────────────────────────────");
  const login = await req("POST", "/auth/login", { email: testAdminEmail, password: "password123" }, "Admin login (fresh test admin)");
  if (login.status !== 200) { console.log("\n❌ Cannot proceed without admin login."); process.exit(1); }
  await get("/auth/me", "GET /auth/me");

  // ── ANALYTICS DASHBOARD ───────────────────────────────
  console.log("\n── ANALYTICS DASHBOARD ───────────────────────");
  await get("/admin/analytics/dashboard", "GET dashboard");

  // ── BRANCHES (dropdown source) ────────────────────────
  console.log("\n── BRANCHES ──────────────────────────────────");
  const branches = await get("/admin/branches", "GET branches");
  const branchId = branches.data?.branches?.[0]?._id;

  // ── CATEGORIES ────────────────────────────────────────
  console.log("\n── CATEGORIES ────────────────────────────────");
  const catList = await get("/admin/categories", "GET categories");
  const catId = catList.data?.categories?.[0]?._id;
  const catCreate = await post("/admin/categories", { name: `Audit Cat ${uniq}`, description: "audit" }, "CREATE category");
  let newCatId = catCreate.data?.category?._id;
  await post("/admin/categories", { name: `Audit Cat ${uniq}` }, "CREATE duplicate category → 409", [409]);
  await post("/admin/categories", {}, "CREATE no name → 400", [400]);
  if (newCatId) {
    await patch(`/admin/categories/${newCatId}`, { name: `Audit Cat Up ${uniq}` }, "UPDATE category");
    // Clean up so unique names don't accumulate
    await del(`/admin/categories/${newCatId}`, "DELETE category");
  }
  await patch("/admin/categories/000000000000000000000000", { name: "x" }, "UPDATE missing category → 404", [404]);
  await get("/admin/categories/000000000000000000000000", "GET missing category → 404", [404]);
  await get("/admin/categories/badid", "GET invalid category id → 400", [400]);

  // ── PRODUCTS ──────────────────────────────────────────
  console.log("\n── PRODUCTS ──────────────────────────────────");
  const prodList = await get("/admin/products", "GET products");
  const existingProduct = prodList.data?.products?.[0];
  await post("/admin/products", { sku: `A${uniq}`, name: "NoCat", price: 1, stock: 1 }, "CREATE missing fields → 400", [400]);
  const prodCreate = await post("/admin/products", {
    sku: `AUD${uniq}`, barcode: `B${uniq}`, name: `Audit Prod ${uniq}`,
    description: "audit", categoryId: catId, price: 99.5, stock: 10,
  }, "CREATE product");
  const newProdId = prodCreate.data?.product?._id;
  if (newProdId) {
    await patch(`/admin/products/${newProdId}`, { price: 149.75, stock: 5 }, "UPDATE product");
    await get(`/admin/products/${newProdId}`, "GET product by id");
    await del(`/admin/products/${newProdId}`, "DELETE product");
  }
  await patch("/admin/products/000000000000000000000000", { price: 1 }, "UPDATE missing product → 404", [404]);
  await del("/admin/products/000000000000000000000000", "DELETE missing product → 404", [404]);
  // Duplicate SKU → should be a clean 409 or 400, NOT a bare 500
  if (existingProduct) {
    await post("/admin/products", {
      sku: existingProduct.sku, barcode: `X${uniq}`, name: "Dup SKU",
      categoryId: catId, price: 1, stock: 1,
    }, "CREATE duplicate SKU → 4xx not 500", [400, 409]);
  }

  // ── RIDERS ────────────────────────────────────────────
  console.log("\n── RIDERS ────────────────────────────────────");
  const riderList = await get("/admin/riders", "GET riders");
  const riderEmail = `auditrider${uniq}@test.com`;
  const riderCreate = await post("/admin/riders", {
    firstname: "Audit", lastname: "Rider", email: riderEmail, password: "password123",
    assignedBranch: branchId, phone: "09171234567", address: "Test Address",
    age: 25, vehicleType: "Motorcycle", vehiclePlateNumber: `ARD${uniq.slice(-4)}`,
  }, "CREATE rider");
  const newRiderId = riderCreate.data?.data?._id;
  await post("/admin/riders", { firstname: "Kid", lastname: "Rider", email: `kid${uniq}@t.com`, password: "password123", assignedBranch: branchId, phone: "0917", address: "x", age: 16, vehicleType: "Bike", vehiclePlateNumber: "KID1" }, "CREATE underage rider → 400", [400]);
  if (newRiderId) {
    await patch(`/admin/riders/${newRiderId}`, { phone: "09181112222", availabilityStatus: "available" }, "UPDATE rider");
    await patch(`/admin/riders/${newRiderId}`, { availabilityStatus: "flying" }, "UPDATE bad status → 400", [400]);
    await del(`/admin/riders/${newRiderId}`, "DELETE rider");
  }
  await del("/admin/riders/000000000000000000000000", "DELETE missing rider → 404", [404]);

  // ── CUSTOMERS ─────────────────────────────────────────
  console.log("\n── CUSTOMERS ─────────────────────────────────");
  const custList = await get("/admin/customers", "GET customers");
  const custEmail = `auditcust${uniq}@test.com`;
  const custCreate = await post("/admin/customers", {
    firstname: "Audit", lastname: "Customer", email: custEmail, password: "password123",
  }, "CREATE customer");
  const newCustId = custCreate.data?.data?._id;
  await post("/admin/customers", { firstname: "Audit", lastname: "Customer", email: custEmail, password: "password123" }, "CREATE duplicate email → 409", [409]);
  await post("/admin/customers", { firstname: "No", lastname: "Fields" }, "CREATE missing fields → 400", [400]);
  if (newCustId) {
    await patch(`/admin/customers/${newCustId}`, { firstname: "Updated" }, "UPDATE customer");
    await patch(`/admin/customers/${newCustId}/status`, {}, "TOGGLE customer status");
    await patch(`/admin/customers/${newCustId}/status`, {}, "TOGGLE back");
    await get(`/admin/customers/${newCustId}`, "GET customer by id");
    await del(`/admin/customers/${newCustId}`, "DELETE customer");
  }
  await del("/admin/customers/000000000000000000000000", "DELETE missing customer → 404", [404]);

  // ── ORDERS (read-only for admin) ──────────────────────
  console.log("\n── ORDERS ────────────────────────────────────");
  const orders = await get("/orders", "GET orders (admin sees all)");
  const firstOrder = orders.data?.orders?.[0];
  if (firstOrder) {
    await get(`/orders/${firstOrder._id}`, "GET order by id");
  } else {
    console.log("   (no orders in DB — skipping order detail)");
  }

  // ── PROFILE ───────────────────────────────────────────
  console.log("\n── PROFILE ───────────────────────────────────");
  await get("/admin/profile/me", "GET admin profile");
  await patch("/admin/profile/me", {}, "PATCH admin profile (no-op)");

  // ── ROLE GUARD ────────────────────────────────────────
  console.log("\n── ROLE GUARD (admin blocked from superadmin) ─");
  await get("/superadmin/branches", "GET superadmin branches → 403", [403]);
  await get("/superadmin/admins", "GET superadmin admins → 403", [403]);
  await get("/superadmin/audit", "GET superadmin audit → 403", [403]);
  await get("/superadmin/profile/me", "GET superadmin profile → 403", [403]);
  await get("/superadmin/analytics/dashboard", "GET superadmin analytics → 403", [403]);

  // ── SUMMARY ───────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  if (FAILURES.length === 0) {
    console.log("🎉 ALL ADMIN API CHECKS PASSED");
  } else {
    console.log(`❌ ${FAILURES.length} FAILURE(S):`);
    FAILURES.forEach((f) => console.log(`   • ${f}`));
    process.exitCode = 1;
  }

  // ── CLEANUP: remove the test admin ────────────────────
  if (testAdminUserId) {
    Object.keys(c).forEach((k) => delete c[k]);
    await req("POST", "/auth/login", { email: "patrickzambrano48@gmail.com", password: "12345678" }, "Superadmin re-login (cleanup)");
    await del(`/superadmin/admins/${testAdminProfileId ?? testAdminUserId}`, "DELETE test admin (cleanup)");
    console.log("\n🧹 Test admin cleaned up.");
  }
}

run().catch((e) => { console.error("AUDIT CRASHED:", e.message); process.exit(1); });
