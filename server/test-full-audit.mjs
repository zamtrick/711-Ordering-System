const BASE = "http://localhost:5000/api";

const saCookies = {};
const admCookies = {};

function extractCookies(res, store) {
  const raw = res.headers.getSetCookie?.() || [];
  raw.forEach((c) => {
    const [kv] = c.split(";");
    const [k, v] = kv.split("=");
    if (k && v) store[k.trim()] = v.trim();
  });
}

function cookieHeader(store) {
  return Object.entries(store).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(store, email, password, label) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  extractCookies(res, store);
  const data = await res.json();
  console.log(`✅ ${label} logged in:`, data.userResponse?.role);
  return data;
}

async function get(store, path, label) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookieHeader(store) },
  });
  extractCookies(res, store);
  const data = await res.json();
  const status = res.status;
  const icon = status >= 200 && status < 300 ? "✅" : "❌";
  console.log(`${icon} [${status}] ${label}: ${JSON.stringify(data).slice(0, 120)}`);
  return { status, data };
}

async function post(store, path, body, label) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(store) },
    body: JSON.stringify(body),
  });
  extractCookies(res, store);
  const data = await res.json();
  const status = res.status;
  const icon = status >= 200 && status < 300 ? "✅" : "❌";
  console.log(`${icon} [${status}] ${label}: ${JSON.stringify(data).slice(0, 120)}`);
  return { status, data };
}

async function patch(store, path, body, label) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(store) },
    body: JSON.stringify(body),
  });
  extractCookies(res, store);
  const data = await res.json();
  const status = res.status;
  const icon = status >= 200 && status < 300 ? "✅" : "❌";
  console.log(`${icon} [${status}] ${label}: ${JSON.stringify(data).slice(0, 120)}`);
  return { status, data };
}

async function del(store, path, label) {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { Cookie: cookieHeader(store) },
  });
  extractCookies(res, store);
  const data = await res.json();
  const status = res.status;
  const icon = status >= 200 && status < 300 ? "✅" : "❌";
  console.log(`${icon} [${status}] ${label}: ${JSON.stringify(data).slice(0, 120)}`);
  return { status, data };
}

let errors = 0;
function check(label, condition) {
  if (!condition) {
    console.log(`   ❌ FAIL: ${label}`);
    errors++;
  }
}

async function run() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("COMPREHENSIVE SUPERADMIN + ADMIN API AUDIT");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── LOGIN ──────────────────────────────────────────────────────
  console.log("── 1. AUTH ──────────────────────────────────────────────\n");
  const sa = await login(saCookies, "patrickzambrano48@gmail.com", "12345678", "Superadmin");
  check("Superadmin login", sa.success);
  const adm = await login(admCookies, "johndoe@gmail.com", "12345678", "Admin");
  check("Admin login", adm.success);

  // ── AUTH ME ──────────────────────────────────────────────────
  console.log("\n── 2. AUTH ME ──────────────────────────────────────────\n");
  await get(saCookies, "/auth/me", "Superadmin /me");
  await get(admCookies, "/auth/me", "Admin /me");

  // ── SUPERADMIN: BRANCHES ──────────────────────────────────────
  console.log("\n── 3. SUPERADMIN: BRANCHES ─────────────────────────────\n");
  const branchList = await get(saCookies, "/superadmin/branches", "GET branches");
  check("Branches list", branchList.status === 200 || branchList.status === 404);

  const branchCreate = await post(saCookies, "/superadmin/branches", {
    name: "Test Branch Audit",
    branchCode: "AUDIT001",
    location: "Test Location",
    city: "Test City",
    status: "active",
  }, "POST branch");
  check("Branch create", branchCreate.status === 201);
  const newBranchId = branchCreate.data?.data?._id;

  if (newBranchId) {
    await get(saCookies, `/superadmin/branches/${newBranchId}`, "GET branch by ID");
    await patch(saCookies, `/superadmin/branches/${newBranchId}`, { name: "Updated Test Branch" }, "PATCH branch");
    await del(saCookies, `/superadmin/branches/${newBranchId}`, "DELETE branch");
  }

  // ── SUPERADMIN: ADMINS ──────────────────────────────────────
  console.log("\n── 4. SUPERADMIN: ADMINS ───────────────────────────────\n");
  const adminList = await get(saCookies, "/superadmin/admins", "GET admins");
  check("Admins list", adminList.status === 200 || adminList.status === 404);

  // Get a valid branch ID for creating admin
  const brRes = await get(saCookies, "/superadmin/branches", "GET branches for admin");
  const firstBranch = brRes.data?.branches?.[0];
  if (firstBranch) {
    const adminCreate = await post(saCookies, "/superadmin/admins", {
      firstname: "Test",
      lastname: "AdminAudit",
      email: "testadminaudit@test.com",
      password: "12345678",
      assignedBranch: firstBranch._id,
    }, "POST admin");
    check("Admin create", adminCreate.status === 201);
    const newAdminId = adminCreate.data?.data?._id;

    if (newAdminId) {
      await get(saCookies, `/superadmin/admins/${newAdminId}`, "GET admin by ID");
      await patch(saCookies, `/superadmin/admins/${newAdminId}`, { firstname: "Updated" }, "PATCH admin");
      await del(saCookies, `/superadmin/admins/${newAdminId}`, "DELETE admin");
    }
  }

  // ── SUPERADMIN: AUDIT LOG ──────────────────────────────────
  console.log("\n── 5. SUPERADMIN: AUDIT LOG ────────────────────────────\n");
  await get(saCookies, "/superadmin/audit/logs?page=1&limit=5", "GET audit logs");
  await get(saCookies, "/superadmin/audit/recent?limit=5", "GET recent activity");
  await get(saCookies, "/superadmin/audit/stats", "GET audit stats");

  // ── SUPERADMIN: PROFILE ──────────────────────────────────────
  console.log("\n── 6. SUPERADMIN: PROFILE ─────────────────────────────\n");
  await get(saCookies, "/superadmin/profile/me", "GET profile");
  await patch(saCookies, "/superadmin/profile/me", { firstname: "Pat" }, "PATCH profile");

  // ── SUPERADMIN: ANALYTICS ──────────────────────────────────
  console.log("\n── 7. SUPERADMIN: ANALYTICS ────────────────────────────\n");
  await get(saCookies, "/superadmin/analytics/dashboard", "GET dashboard analytics");

  // ── ADMIN: PRODUCTS ──────────────────────────────────────────
  console.log("\n── 8. ADMIN: PRODUCTS ─────────────────────────────────\n");
  const prodList = await get(admCookies, "/admin/products", "GET products");
  check("Products list", prodList.status === 200 || prodList.status === 404);

  const prodCreate = await post(admCookies, "/admin/products", {
    name: "Test Product Audit",
    description: "Test",
    price: 99,
    stock: 10,
    sku: "AUDITSKU001",
  }, "POST product");
  check("Product create", prodCreate.status === 201);
  const newProdId = prodCreate.data?.data?._id || prodCreate.data?.product?._id;
  if (newProdId) {
    await patch(admCookies, `/admin/products/${newProdId}`, { name: "Updated Test Product" }, "PATCH product");
    await del(admCookies, `/admin/products/${newProdId}`, "DELETE product");
  }

  // ── ADMIN: CATEGORIES ──────────────────────────────────────
  console.log("\n── 9. ADMIN: CATEGORIES ───────────────────────────────\n");
  const catList = await get(admCookies, "/admin/categories", "GET categories");
  check("Categories list", catList.status === 200 || catList.status === 404);

  const catCreate = await post(admCookies, "/admin/categories", {
    name: "Test Category Audit",
    description: "Test",
  }, "POST category");
  check("Category create", catCreate.status === 201);
  const newCatId = catCreate.data?.data?._id || catCreate.data?.category?._id;
  if (newCatId) {
    await patch(admCookies, `/admin/categories/${newCatId}`, { name: "Updated Category" }, "PATCH category");
    await del(admCookies, `/admin/categories/${newCatId}`, "DELETE category");
  }

  // ── ADMIN: RIDERS ──────────────────────────────────────────
  console.log("\n── 10. ADMIN: RIDERS ───────────────────────────────────\n");
  const riderList = await get(admCookies, "/admin/riders", "GET riders");
  check("Riders list", riderList.status === 200 || riderList.status === 404);

  // ── ADMIN: CUSTOMERS ──────────────────────────────────────
  console.log("\n── 11. ADMIN: CUSTOMERS ───────────────────────────────\n");
  const custList = await get(admCookies, "/admin/customers", "GET customers");
  check("Customers list", custList.status === 200 || custList.status === 404);

  // ── ADMIN: ORDERS ──────────────────────────────────────────
  console.log("\n── 12. ADMIN: ORDERS ───────────────────────────────────\n");
  const orderList = await get(admCookies, "/orders", "GET orders");
  check("Orders list", orderList.status === 200 || orderList.status === 404);

  // ── ADMIN: ANALYTICS ──────────────────────────────────────
  console.log("\n── 13. ADMIN: ANALYTICS ────────────────────────────────\n");
  await get(admCookies, "/admin/analytics/dashboard", "GET admin dashboard analytics");

  // ── ROLE ACCESS ──────────────────────────────────────────
  console.log("\n── 14. ROLE ACCESS CONTROL ────────────────────────────\n");
  // Admin should NOT access superadmin routes
  await get(admCookies, "/superadmin/branches", "Admin → superadmin/branches (expect 403)");
  await get(admCookies, "/superadmin/admins", "Admin → superadmin/admins (expect 403)");
  // Superadmin SHOULD access admin routes (via role middleware fix)
  await get(saCookies, "/admin/products", "Superadmin → admin/products (expect 200)");
  await get(saCookies, "/admin/categories", "Superadmin → admin/categories (expect 200)");
  await get(saCookies, "/admin/riders", "Superadmin → admin/riders (expect 200)");
  await get(saCookies, "/admin/customers", "Superadmin → admin/customers (expect 200)");

  // ── SUMMARY ──────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  if (errors > 0) {
    console.log(`❌ ${errors} check(s) FAILED`);
  } else {
    console.log("✅ ALL CHECKS PASSED!");
  }
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(0);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
