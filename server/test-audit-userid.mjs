// ============================================================
// AUDIT LOG — INVALID QUERY PARAM REGRESSION TEST
// Verifies GET /api/superadmin/audit/logs returns a clean 400
// (not a 500) when ?userId is not a valid ObjectId.
// Requires the server running on localhost:5000 and superadmin
// credentials matching the other audit scripts.
// ============================================================
const BASE = "http://localhost:5000/api";

const cookies = {};

function extractCookies(res) {
  (res.headers.getSetCookie?.() || []).forEach((cookie) => {
    const [kv] = cookie.split(";");
    const [k, v] = kv.split("=");
    if (k && v) cookies[k.trim()] = v.trim();
  });
}
const cookieHeader = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookieHeader() },
  });
  extractCookies(res);
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const FAILURES = [];

function expectStatus(label, actual, expected) {
  const ok = expected.includes(actual);
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} [${actual}] ${label} (expect ${expected.join("/")})`);
  if (!ok) FAILURES.push(`${label} → got ${actual}, expected ${expected.join("/")}`);
}

async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  AUDIT LOG — INVALID userId REGRESSION TEST");
  console.log("═══════════════════════════════════════════════\n");

  // ── LOGIN as superadmin (audit routes are superadmin-only) ──
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "patrickzambrano48@gmail.com", password: "12345678" }),
  });
  extractCookies(loginRes);
  if (loginRes.status !== 200) {
    console.log(`❌ Superadmin login failed (${loginRes.status}) — cannot run test.`);
    process.exit(1);
  }
  console.log("✅ Superadmin login\n");

  // ── BASELINE: valid request still works ────────────────────
  const valid = await get("/superadmin/audit/logs?limit=5");
  expectStatus("GET audit logs (valid, no filters)", valid.status, [200]);

  // A real ObjectId from the logs, used as userId — should stay 200
  const realUserId = valid.data?.logs?.[0]?.user?._id;
  if (realUserId) {
    const byUser = await get(`/superadmin/audit/logs?userId=${realUserId}&limit=5`);
    expectStatus("GET audit logs (valid userId from logs)", byUser.status, [200]);
  } else {
    console.log("   (no logs with populated user found — skipping valid-userId case)");
  }

  // ── THE REGRESSION: malformed userId must be 400, not 500 ──
  const malformed = await get("/superadmin/audit/logs?userId=not-an-objectid");
  expectStatus("GET audit logs (malformed userId)", malformed.status, [400]);
  if (malformed.status === 400) {
    const msg = malformed.data?.message ?? "";
    if (/invalid/i.test(msg)) {
      console.log(`   message: "${msg}"`);
    } else {
      FAILURES.push(`400 message should mention "invalid", got: "${msg}"`);
      console.log(`   ⚠️ unexpected message: "${msg}"`);
    }
  }

  // A well-formed but nonexistent ObjectId is VALID input → 200 (empty)
  const validButMissing = await get("/superadmin/audit/logs?userId=000000000000000000000000");
  expectStatus("GET audit logs (well-formed, nonexistent userId)", validButMissing.status, [200]);

  // ── SUMMARY ────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  if (FAILURES.length === 0) {
    console.log("🎉 ALL AUDIT userId CHECKS PASSED");
  } else {
    console.log(`❌ ${FAILURES.length} FAILURE(S):`);
    FAILURES.forEach((f) => console.log(`   • ${f}`));
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error("TEST CRASHED:", e.message);
  process.exit(1);
});
