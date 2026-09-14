// One-off E2E: create promo with image (superadmin) → verify it shows for a
// customer → verify inactive hides it → delete promo.
// Run (from server/): DB_URI="$(grep ^DB_URI .env | cut -d= -f2-)" node promo-e2e.mjs [port]
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import mongoose from "mongoose";

const BASE = `http://localhost:${process.argv[2] || "5051"}/api`;
const SA_EMAIL = "patrickzambrano48@gmail.com";
const SA_PASS = "12345678";
const stamp = Date.now().toString().slice(-8);

let failures = 0;
function ok(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
}

function makeJar() {
  const jar = {};
  return {
    header: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
    store(res) {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const eq = pair.indexOf("=");
        jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      }
    },
  };
}
const saJar = makeJar();
const custJar = makeJar();

async function call(jar, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      Cookie: jar.header(),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  jar.store(res);
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

// 1. Superadmin login
const sa = await call(saJar, "POST", "/auth/login", { email: SA_EMAIL, password: SA_PASS });
ok("superadmin login → 200", sa.status === 200, `got ${sa.status}`);

// 2. Create promo (active, with subtitle)
const title = `E2E Promo ${stamp}`;
const subtitle = `Live verification ${stamp}`;
const created = await call(saJar, "POST", "/superadmin/promos", { title, subtitle, isActive: true, sortOrder: 1 });
ok("create promo → 201", created.status === 201, `got ${created.status}`);
const promoId = created.data?.promo?._id;
ok("promo has _id", Boolean(promoId));

// 3. Upload image (real PNG from the admin app's assets)
const imgBytes = fs.readFileSync(path.resolve(process.cwd(), "..", "admin", "src", "assets", "hero.png"));
const form = new FormData();
form.append("image", new Blob([imgBytes], { type: "image/png" }), "hero.png");
const up = await call(saJar, "POST", `/superadmin/promos/${promoId}/image`, form);
ok("upload image → 200", up.status === 200, `got ${up.status}`);
const imageUrl = up.data?.promo?.image;
ok("image URL stored (Cloudinary)", typeof imageUrl === "string" && imageUrl.startsWith("https://res.cloudinary.com"), imageUrl || "(none)");

// 4. Fresh customer registers (register issues a session) then is verified
const email = `promoe2e${stamp}@test.com`;
const reg = await call(custJar, "POST", "/auth/register", { firstname: "Promo", lastname: "E2E", email, password: "password123" });
ok("customer register → 201", reg.status === 201, `got ${reg.status}`);

// Test setup only: flip the flag directly (same trick as test-customer-flow.mjs)
await mongoose.connect(process.env.DB_URI);
await mongoose.connection.db.collection("users").updateOne(
  { email: email.toLowerCase() },
  { $set: { isVerified: true } },
);
await mongoose.disconnect();

const cust = await call(custJar, "POST", "/auth/login", { email, password: "password123" });
ok("customer login → 200", cust.status === 200, `got ${cust.status}`);

// 5. Customer sees the promo with its image
const list1 = await call(custJar, "GET", "/customer/promos");
const active = list1.data?.data ?? list1.data?.promos ?? [];
const found = active.find((p) => p._id === promoId);
ok("active promo visible to customer", Boolean(found), `list has ${active.length} promo(s)`);
ok("customer promo carries image", Boolean(found?.image), found?.image || "(no image)");
if (imageUrl && found?.image) ok("image matches uploaded URL", found.image === imageUrl);

// 6. Hide it → must disappear
const hide = await call(saJar, "PATCH", `/superadmin/promos/${promoId}`, { isActive: false });
ok("PATCH isActive:false → 200", hide.status === 200, `got ${hide.status}`);
const list2 = await call(custJar, "GET", "/customer/promos");
const active2 = list2.data?.data ?? list2.data?.promos ?? [];
ok("inactive promo hidden from customer", !active2.some((p) => p._id === promoId), `list has ${active2.length} promo(s)`);

// 7. Re-enable → visible again (validates the toggle round-trip the UI offers)
await call(saJar, "PATCH", `/superadmin/promos/${promoId}`, { isActive: true });
const list3 = await call(custJar, "GET", "/customer/promos");
const active3 = list3.data?.data ?? list3.data?.promos ?? [];
ok("re-enabled promo visible again", active3.some((p) => p._id === promoId));

// 8. Delete the promo (typed confirmation) → gone
const del = await call(saJar, "DELETE", `/superadmin/promos/${promoId}`, { confirmText: "DELETE" });
ok("delete promo → 200", del.status === 200, `got ${del.status}`);
const list4 = await call(custJar, "GET", "/customer/promos");
const active4 = list4.data?.data ?? list4.data?.promos ?? [];
ok("deleted promo gone from customer list", !active4.some((p) => p._id === promoId));

// Cleanup: remove the throwaway customer (User + Customer profile)
await mongoose.connect(process.env.DB_URI);
const u = await mongoose.connection.db.collection("users").findOne({ email: email.toLowerCase() });
if (u) {
  await mongoose.connection.db.collection("customers").deleteOne({ user: u._id });
  await mongoose.connection.db.collection("users").deleteOne({ _id: u._id });
}
await mongoose.disconnect();

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
