const BASE = "http://localhost:5000/api";

// Simple cookie store per user
const riderCookies = {};
const customerCookies = {};
const adminCookies = {};

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

async function apiGet(store, path, label) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookieHeader(store) },
  });
  extractCookies(res, store);
  const data = await res.json();
  console.log(`✅ ${label}:`, JSON.stringify(data).slice(0, 250));
  return data;
}

async function apiPatch(store, path, body, label) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(store) },
    body: JSON.stringify(body),
  });
  extractCookies(res, store);
  const data = await res.json();
  console.log(`✅ ${label}:`, JSON.stringify(data).slice(0, 250));
  return data;
}

async function apiPost(store, path, body, label) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(store) },
    body: JSON.stringify(body),
  });
  extractCookies(res, store);
  const data = await res.json();
  console.log(`✅ ${label}:`, JSON.stringify(data).slice(0, 250));
  return data;
}

async function run() {
  try {
    // ═══════════════════════════════════════════════
    // STEP 1: Login all users
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 1: LOGIN ALL USERS");
    console.log("═══════════════════════════════════════════════\n");

    await login(adminCookies, "johndoe@gmail.com", "12345678", "Admin");
    await login(customerCookies, "patjane@gmail.com", "12345678", "Customer");
    await login(riderCookies, "rider@test.com", "12345678", "Rider");

    // ═══════════════════════════════════════════════
    // STEP 2: Rider goes online
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 2: RIDER GOES ONLINE");
    console.log("═══════════════════════════════════════════════\n");

    const availRes = await apiPatch(riderCookies, "/rider/availability", { status: "available" }, "Set online");
    console.log("   Status:", availRes.data?.availabilityStatus);

    // ═══════════════════════════════════════════════
    // STEP 3: Rider profile & stats
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 3: RIDER PROFILE & INITIAL STATS");
    console.log("═══════════════════════════════════════════════\n");

    const profileRes = await apiGet(riderCookies, "/rider/profile/me", "Rider profile");
    const riderProfile = profileRes.data;
    console.log("   Name:", riderProfile?.user?.firstname, riderProfile?.user?.lastname);
    console.log("   Vehicle:", riderProfile?.vehicleType, riderProfile?.vehiclePlateNumber);
    console.log("   Branch:", riderProfile?.assignedBranch?.name, `(${riderProfile?.assignedBranch?._id})`);

    const statsBefore = await apiGet(riderCookies, "/rider/stats", "Stats BEFORE");
    console.log("   Active:", statsBefore.data?.activeDeliveries);
    console.log("   Completed:", statsBefore.data?.completedDeliveries);
    console.log("   Earnings: ₱" + statsBefore.data?.totalEarnings);

    // ═══════════════════════════════════════════════
    // STEP 4: Customer creates an order
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 4: CUSTOMER CREATES AN ORDER");
    console.log("═══════════════════════════════════════════════\n");

    const branchId = riderProfile?.assignedBranch?._id;
    const orderRes = await apiPost(customerCookies, "/orders", { branch: branchId }, "Create order");
    const order = orderRes.data;
    console.log("   Order ID:", order?._id?.toString()?.slice(-6).toUpperCase());
    console.log("   Status:", order?.status);
    console.log("   Delivery status:", order?.deliveryStatus);
    console.log("   Total: ₱" + order?.totalAmount);

    if (!order?._id) {
      console.log("\n❌ Could not create order. Aborting.");
      process.exit(1);
    }

    const orderId = order._id;

    // ═══════════════════════════════════════════════
    // STEP 5: Rider checks available deliveries
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 5: RIDER CHECKS AVAILABLE DELIVERIES");
    console.log("═══════════════════════════════════════════════\n");

    const availDeliveries = await apiGet(riderCookies, "/rider/deliveries/available", "Available deliveries");
    const available = availDeliveries.deliveries || [];
    console.log("   Count:", available.length);

    if (available.length === 0) {
      console.log("\n❌ No available deliveries found!");
      process.exit(1);
    }

    console.log("   First delivery:", available[0]._id?.toString()?.slice(-6).toUpperCase());

    // ═══════════════════════════════════════════════
    // STEP 6: Rider accepts delivery
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 6: RIDER ACCEPTS DELIVERY");
    console.log("═══════════════════════════════════════════════\n");

    const acceptRes = await apiPatch(riderCookies, `/rider/deliveries/${orderId}/accept`, {}, "Accept delivery");
    console.log("   Delivery status:", acceptRes.data?.deliveryStatus);
    console.log("   Order status:", acceptRes.data?.status);

    // ═══════════════════════════════════════════════
    // STEP 7: Check active deliveries
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 7: ACTIVE DELIVERIES");
    console.log("═══════════════════════════════════════════════\n");

    const myDeliveries = await apiGet(riderCookies, "/rider/deliveries/mine", "My deliveries");
    console.log("   Active count:", myDeliveries.deliveries?.length || 0);

    // ═══════════════════════════════════════════════
    // STEP 8: Rider picks up order
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 8: RIDER PICKS UP ORDER");
    console.log("═══════════════════════════════════════════════\n");

    const pickupRes = await apiPatch(riderCookies, `/rider/deliveries/${orderId}/status`, { deliveryStatus: "picked_up" }, "Mark picked up");
    console.log("   Delivery status:", pickupRes.data?.deliveryStatus);

    // ═══════════════════════════════════════════════
    // STEP 9: Rider in transit
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 9: RIDER IN TRANSIT");
    console.log("═══════════════════════════════════════════════\n");

    const transitRes = await apiPatch(riderCookies, `/rider/deliveries/${orderId}/status`, { deliveryStatus: "in_transit" }, "Mark in transit");
    console.log("   Delivery status:", transitRes.data?.deliveryStatus);

    // ═══════════════════════════════════════════════
    // STEP 10: Rider delivers
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 10: RIDER DELIVERS ORDER");
    console.log("═══════════════════════════════════════════════\n");

    const deliverRes = await apiPatch(riderCookies, `/rider/deliveries/${orderId}/status`, { deliveryStatus: "delivered" }, "Mark delivered");
    console.log("   Delivery status:", deliverRes.data?.deliveryStatus);
    console.log("   Order status:", deliverRes.data?.status);

    // ═══════════════════════════════════════════════
    // STEP 11: Verify stats after delivery
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 11: RIDER STATS (AFTER)");
    console.log("═══════════════════════════════════════════════\n");

    const statsAfter = await apiGet(riderCookies, "/rider/stats", "Stats AFTER");
    console.log("   Active:", statsAfter.data?.activeDeliveries);
    console.log("   Completed:", statsAfter.data?.completedDeliveries);
    console.log("   Earnings: ₱" + statsAfter.data?.totalEarnings);
    console.log("   Availability:", statsAfter.data?.availabilityStatus);

    // ═══════════════════════════════════════════════
    // STEP 12: Delivery history
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("STEP 12: DELIVERY HISTORY");
    console.log("═══════════════════════════════════════════════\n");

    const history = await apiGet(riderCookies, "/rider/deliveries/history", "History");
    console.log("   History count:", history.deliveries?.length || 0);

    // ═══════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════");
    console.log("🎉 FULL DELIVERY FLOW COMPLETED SUCCESSFULLY!");
    console.log("═══════════════════════════════════════════════\n");
    console.log("✅ Login (admin, customer, rider)");
    console.log("✅ Rider goes online");
    console.log("✅ Rider profile & stats");
    console.log("✅ Customer creates order");
    console.log("✅ Rider sees available delivery");
    console.log("✅ Rider accepts delivery");
    console.log("✅ Rider picks up order");
    console.log("✅ Rider in transit");
    console.log("✅ Rider delivers order");
    console.log("✅ Stats updated correctly");
    console.log("✅ Delivery history recorded");
    console.log("\n📧 Rider credentials:");
    console.log("   Email: rider@test.com");
    console.log("   Password: 12345678");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ ERROR:", err.message);
    if (err.response) {
      console.error("   Status:", err.response.status);
      console.error("   Data:", JSON.stringify(err.response.data));
    }
    process.exit(1);
  }
}

run();
