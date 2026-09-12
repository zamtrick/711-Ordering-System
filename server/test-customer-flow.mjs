// End-to-end audit of the customer mobile app flow against the live API.
// Simulates exactly what customer-mobile does: register → verify OTP →
// products → branches → cart → checkout (order + items) → orders → cancel
// → profile → logout.
// Everything through the API, so it works with any env — with one documented
// exception: OTP codes are hashed + emailed by design (unreadable via API),
// so the test flips isVerified directly to simulate entering the code.

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const B = process.env.API_BASE || "http://localhost:5000/api";

let passed = 0;
let failed = 0;
const cleanupIds = { users: [] };

const ok = (label, cond, extra = "") => {
  if (cond) {
    passed++;
    console.log(`✅ ${label}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`❌ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ---------------------------------------------------------------
// fetch client with a manual cookie jar (mirrors axios-cookiejar on mobile)
// ---------------------------------------------------------------
const jar = new Map(); // cookie name -> value

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
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

// Unique account per run — shared accounts can be deactivated/edited externally
// (e.g. while testing the admin panel), which would break re-runs.
const stamp = Date.now().toString().slice(-8);
const TEST_EMAIL = `cust${stamp}@test.com`;
const TEST_PASS = "password123";
const SA_EMAIL = "patrickzambrano48@gmail.com";
const SA_PASS = "12345678";
const SET_FEE = 25; // fee we set for the test run (restored to 20 after)

// ---------------------------------------------------------------
// 0. Delivery fee setup (admin PUT, public GET, validation)
// ---------------------------------------------------------------
{
  // login as superadmin first — only admins can change the fee
  const saLogin = await call("POST", "/auth/login", { email: SA_EMAIL, password: SA_PASS });
  ok("POST /auth/login (superadmin) → 200", saLogin.status === 200, `got ${saLogin.status}`);

  const pub = await call("GET", "/settings/delivery-fee");
  ok(
    "GET /settings/delivery-fee (public) → 200",
    pub.status === 200 && typeof pub.data?.data?.fee === "number",
    `got ${pub.status} fee=${pub.data?.data?.fee}`,
  );

  // set a known fee for deterministic order math
  const put = await call("PUT", "/settings/delivery-fee", { fee: SET_FEE });
  ok(
    `PUT /settings/delivery-fee ${SET_FEE} (superadmin) → 200`,
    put.status === 200 && put.data?.data?.fee === SET_FEE,
    `got ${put.status}`,
  );

  const invalid = await call("PUT", "/settings/delivery-fee", { fee: -5 });
  ok("  PUT negative fee → 400", invalid.status === 400, `got ${invalid.status}`);

  // anonymous PUT check needs a clean jar — logout, test, login again
  await call("POST", "/auth/logout");
  const anon = await call("PUT", "/settings/delivery-fee", { fee: 99 });
  ok("  PUT without auth → 401", anon.status === 401, `got ${anon.status}`);
  await call("POST", "/auth/login", { email: SA_EMAIL, password: SA_PASS });
  await call("POST", "/auth/logout"); // back to anonymous for the register flow
}

// ---------------------------------------------------------------
// 1. REGISTER (register.tsx → POST /auth/register)
// 201 on first run, 409 on re-runs (account reused) — both valid.
// ---------------------------------------------------------------
{
  const r = await call("POST", "/auth/register", {
    firstname: "Test",
    lastname: "Customer",
    email: TEST_EMAIL,
    password: TEST_PASS,
  });
  ok(
    "POST /auth/register → 201 (or 409 if reused)",
    r.status === 201 || r.status === 409,
    `got ${r.status} ${JSON.stringify(r.data?.message ?? "")}`,
  );
  if (r.data?.data?.id) cleanupIds.users.push(r.data.data.id);

  if (r.status === 201) {
    // Fresh accounts start unverified — the browse-not-buy gate must refuse
    // order creation (register session is already in the jar).
    const gated = await call("POST", "/orders", {});
    ok(
      "  unverified POST /orders → 403 EMAIL_NOT_VERIFIED",
      gated.status === 403 && gated.data?.code === "EMAIL_NOT_VERIFIED",
      `got ${gated.status}`,
    );
  } else {
    // 409: account reused from an earlier run — login (200 if that run
    // verified it, 403 if the run died before verification).
    const l = await call("POST", "/auth/login", { email: TEST_EMAIL, password: TEST_PASS });
    ok(
      "POST /auth/login → 200 (or 403 if never verified)",
      l.status === 200 || l.status === 403,
      `got ${l.status} ${JSON.stringify(l.data?.message ?? "")}`,
    );
  }

  // Test setup only: flip the flag directly to simulate entering the OTP.
  await mongoose.connect(process.env.DB_URI);
  await mongoose.connection.db
    .collection("users")
    .updateOne({ email: TEST_EMAIL.toLowerCase() }, { $set: { isVerified: true } });
  await mongoose.disconnect();

  // Re-establish the session in case we never had one (403 login path).
  const meCheck = await call("GET", "/auth/me");
  if (meCheck.status === 401) {
    const l2 = await call("POST", "/auth/login", { email: TEST_EMAIL, password: TEST_PASS });
    ok("  login after verification → 200", l2.status === 200, `got ${l2.status}`);
  } else {
    ok(
      "  /auth/me shows isVerified",
      meCheck.data?.data?.isVerified === true,
      `got ${JSON.stringify(meCheck.data?.data?.isVerified)}`,
    );
  }
}

// ---------------------------------------------------------------
// 2. PRODUCTS (products.tsx → GET /customer/products, expects {data: []})
// ---------------------------------------------------------------
{
  const r = await call("GET", "/customer/products");
  const list = r.data?.data;
  ok(
    "GET /customer/products → 200 {data: [...]}",
    r.status === 200 && Array.isArray(list),
    `got ${r.status}`,
  );
  const withCat = list?.filter((p) => p.categoryId?.name)?.length ?? 0;
  ok("  products include category names", withCat > 0, `${withCat}/${list?.length} populated`);
  const withPrice = list?.filter((p) => typeof p.price === "number")?.length ?? 0;
  ok("  products have numeric price", withPrice === list?.length);
}

// ---------------------------------------------------------------
// 3. BRANCHES (cart.tsx → GET /customer/branches, expects {data: [...]})
// ---------------------------------------------------------------
let branchId;
{
  const r = await call("GET", "/customer/branches");
  const list = r.data?.data;
  ok(
    "GET /customer/branches → 200 {data: [...]}",
    r.status === 200 && Array.isArray(list),
    `got ${r.status}`,
  );
  branchId = list?.[0]?._id;
  ok("  at least one active branch exists", Boolean(branchId));
}

// ---------------------------------------------------------------
// 4. CHECKOUT (cart.tsx: POST /orders → POST /orders/:id/items)
// ---------------------------------------------------------------
let orderId;
{
  const pr = await call("GET", "/customer/products");
  const products = pr.data?.data ?? [];
  // Respect real stock levels — order half of available stock per item (min 1),
  // capped at 2, so the test works against any data.
  const cart = products
    .filter((p) => p.stock > 0)
    .slice(0, 2)
    .map((p) => ({
      id: p._id,
      price: p.price,
      quantity: Math.max(1, Math.min(2, Math.floor(p.stock / 2))),
      stock: p.stock,
    }));

  const r = await call("POST", "/orders", { branch: branchId, paymentMethod: "cash" });
  ok(
    "POST /orders → 201",
    r.status === 201,
    r.status !== 201 ? `got ${r.status} ${JSON.stringify(r.data)}` : "",
  );
  orderId = r.data?.data?._id;

  // Payment method is validated against the branch and recorded as a
  // pending Payment linked to the order.
  ok(
    "  order carries paymentMethod=cash (status pending)",
    r.data?.data?.payment?.paymentMethod === "cash" &&
      r.data?.data?.payment?.status === "pending",
    `got ${JSON.stringify(r.data?.data?.payment?.paymentMethod)}/${JSON.stringify(r.data?.data?.payment?.status)}`,
  );

  // Rejected method → 400 with a helpful message
  const badPay = await call("POST", "/orders", { branch: branchId, paymentMethod: "bitcoin" });
  ok(
    "  unknown paymentMethod → 400",
    badPay.status === 400,
    `got ${badPay.status}`,
  );

  // New empty order starts at exactly the delivery fee
  ok(
    "  empty order totalAmount === delivery fee (snapshot)",
    r.data?.data?.totalAmount === SET_FEE && r.data?.data?.deliveryFee === SET_FEE,
    `total=${r.data?.data?.totalAmount} fee=${r.data?.data?.deliveryFee}`,
  );

  if (orderId && cart.length === 2) {
    const results = await Promise.all(
      cart.map((c) =>
        call("POST", `/orders/${orderId}/items`, {
          productId: c.id,
          quantity: c.quantity,
        }),
      ),
    );
    const allCreated = results.every((r) => r.status === 201);
    ok(
      "POST /orders/:id/items ×2 → 201",
      allCreated,
      results.map((r) => r.status).join(","),
    );

    // verify server-computed total matches the app's cart math (items + fee)
    const od = await call("GET", `/orders/${orderId}`);
    const expected = SET_FEE + cart.reduce((s, c) => s + c.price * c.quantity, 0);
    ok(
      "  order totalAmount === items + delivery fee",
      Math.abs((od.data?.data?.totalAmount ?? -1) - expected) < 0.001,
      `server=${od.data?.data?.totalAmount} expected=${expected}`,
    );

    // stock guard: order far beyond stock → should 400 (not 500)
    const over = await call("POST", `/orders/${orderId}/items`, {
      productId: cart[0].id,
      quantity: 99999,
    });
    ok(
      "  ordering beyond stock → 400 (not 500)",
      over.status === 400,
      `got ${over.status} ${JSON.stringify(over.data?.message ?? "")}`,
    );
  }
}

// ---------------------------------------------------------------
// 5. ORDERS LIST (orders.tsx → GET /orders, expects {orders: []})
// ---------------------------------------------------------------
{
  const r = await call("GET", "/orders");
  const list = r.data?.orders;
  ok(
    "GET /orders → 200 {orders: [...]}",
    r.status === 200 && Array.isArray(list),
    `got ${r.status}`,
  );
  const mine = list?.find((o) => o._id === orderId);
  ok("  our order appears in list", Boolean(mine));
  ok(
    "  orderItems populated with product names",
    mine?.orderItems?.every((i) => i.product?.name) ?? false,
  );
  ok(
    "  order has valid createdAt",
    Boolean(mine?.createdAt) && !Number.isNaN(new Date(mine.createdAt).getTime()),
  );
}

// ---------------------------------------------------------------
// 6. CANCEL ORDER (orders.tsx → PATCH /orders/:id/cancel)
// ---------------------------------------------------------------
{
  const r = await call("PATCH", `/orders/${orderId}/cancel`);
  ok(
    "PATCH /orders/:id/cancel → 200",
    r.status === 200,
    r.status !== 200 ? `got ${r.status} ${JSON.stringify(r.data)}` : "",
  );
  ok("  status is now 'cancelled'", r.data?.data?.status === "cancelled");

  const again = await call("PATCH", `/orders/${orderId}/cancel`);
  ok("  re-cancel → 400 with message", again.status === 400, `got ${again.status}`);
}

// ---------------------------------------------------------------
// 7. PROFILE (profile.tsx → GET/PATCH /customer/profile/me)
// ---------------------------------------------------------------
{
  const r = await call("GET", "/customer/profile/me");
  ok("GET /customer/profile/me → 200", r.status === 200, `got ${r.status}`);
  ok(
    "  has user.firstname/lastname/email",
    Boolean(r.data?.data?.user?.firstname && r.data?.data?.user?.email),
  );
  // Fresh accounts omit undefined fields (Mongoose) — the app shows "Not set".
  ok(
    "  phone field exists or is undefined (app handles both)",
    r.data?.data?.phone === undefined || typeof r.data?.data?.phone === "string",
    typeof r.data?.data?.phone === "string" ? `"${r.data.data.phone}"` : "undefined",
  );

  const u = await call("PATCH", "/customer/profile/me", {
    firstname: "Updated",
    lastname: "Name",
    phone: "+63 917 999 8888",
    address: "123 Test St",
    age: "25",
  });
  ok(
    "PATCH /customer/profile/me → 200",
    u.status === 200,
    u.status !== 200 ? `got ${u.status} ${JSON.stringify(u.data)}` : "",
  );
  ok("  name updated", u.data?.data?.user?.firstname === "Updated");
  ok("  phone updated", u.data?.data?.phone === "+63 917 999 8888");
  ok("  age stored", String(u.data?.data?.age ?? "") === "25");
}

// ---------------------------------------------------------------
// 8. LOGOUT + auth guard
// ---------------------------------------------------------------
{
  const r = await call("POST", "/auth/logout");
  ok("POST /auth/logout → 200", r.status === 200, `got ${r.status}`);

  const after = await call("GET", "/customer/products");
  ok("  products after logout → 401", after.status === 401, `got ${after.status}`);
}

// ---------------------------------------------------------------
// 9. Role guard: customer cannot hit admin endpoints
// ---------------------------------------------------------------
{
  await call("POST", "/auth/login", { email: TEST_EMAIL, password: TEST_PASS });

  const guard = await call("GET", "/superadmin/branches");
  ok("  GET /superadmin/branches as customer → 403", guard.status === 403, `got ${guard.status}`);

  const guard2 = await call("GET", "/admin/products");
  ok("  GET /admin/products as customer → 403", guard2.status === 403, `got ${guard2.status}`);

  const putAsCust = await call("PUT", "/settings/delivery-fee", { fee: 1 });
  ok("  PUT /settings/delivery-fee as customer → 403", putAsCust.status === 403, `got ${putAsCust.status}`);

  await call("POST", "/auth/logout");
}

// ---------------------------------------------------------------
// 10. Restore default fee (₱20) via superadmin
// ---------------------------------------------------------------
{
  await call("POST", "/auth/login", { email: SA_EMAIL, password: SA_PASS });
  const restore = await call("PUT", "/settings/delivery-fee", { fee: 20 });
  ok(
    "  restore fee to 20 → 200",
    restore.status === 200 && restore.data?.data?.fee === 20,
    `got ${restore.status}`,
  );
  await call("POST", "/auth/logout");
}

// Test account is intentionally kept (reused by future runs).
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
