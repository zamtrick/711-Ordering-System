// End-to-end audit of the customer mobile app flow against the live API.
// Simulates exactly what customer-mobile does: register → products → branches →
// cart → checkout (order + items) → orders → cancel → profile → logout.
// No direct DB access — everything through the API, so it works with any env.

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

  // ensure we have a session (register auto-logs-in; 409 needs explicit login)
  if (r.status === 409) {
    const l = await call("POST", "/auth/login", { email: TEST_EMAIL, password: TEST_PASS });
    ok("POST /auth/login → 200", l.status === 200, `got ${l.status} ${JSON.stringify(l.data?.message ?? "")}`);
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

  const r = await call("POST", "/orders", { branch: branchId });
  ok(
    "POST /orders → 201",
    r.status === 201,
    r.status !== 201 ? `got ${r.status} ${JSON.stringify(r.data)}` : "",
  );
  orderId = r.data?.data?._id;

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

    // verify server-computed total matches the app's cart math
    const od = await call("GET", `/orders/${orderId}`);
    const expected = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    ok(
      "  order totalAmount matches cart subtotal",
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

  await call("POST", "/auth/logout");
}

// Test account is intentionally kept (reused by future runs).
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
