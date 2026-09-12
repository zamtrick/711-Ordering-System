//packages
// Load .env FIRST — before any module that reads env vars at import time
// (e.g. email.service.js captures SMTP_* at load to decide log-only vs SMTP).
// ES module imports are hoisted and evaluated before this module body runs,
// so dotenv.config() further down would be too late.
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import morgan from "morgan";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { initSocket } from "./socket.js";
import chatRoutes from "./routes/chat.routes.js";

import authRoutes from "./routes/auth.routes.js";
import auth from "./middlewares/auth.middleware.js";
import { authorize } from "./middlewares/role.middleware.js";

import manageBranches from "./routes/superadmin/branch.routes.js";
import manageAdmins from "./routes/superadmin/admin.routes.js";
import manageAudit from "./routes/superadmin/audit.routes.js";
import manageProfile from "./routes/superadmin/profile.routes.js";
import manageAnalytics from "./routes/superadmin/analytics.routes.js";
import manageProducts from "./routes/admin/product.routes.js";
import manageCategories from "./routes/admin/category.routes.js";
import manageRiders from "./routes/admin/rider.routes.js";
import manageCustomer from "./routes/admin/customer.routes.js";
import manageAdminAnalytics from "./routes/admin/analytics.routes.js";
import manageAdminBranches from "./routes/admin/branch.routes.js";
import manageAdminProfile from "./routes/admin/profile.routes.js";
import manageOrderItems from "./routes/customer/orderItem.routes.js";
import manageOrders from "./routes/customer/order.routes.js";
import manageProfileCustomer from "./routes/profile.routes.js";
import manageCustomerProducts from "./routes/customer/product.routes.js";
import manageCustomerBranches from "./routes/customer/branch.routes.js";
import manageSettings from "./routes/settings.routes.js";
import manageRiderRoutes from "./routes/rider/rider.routes.js";
import managePromos from "./routes/superadmin/promo.routes.js";
import manageCustomerPromos from "./routes/customer/promo.routes.js";
import manageBranchInventory from "./routes/admin/branchInventory.routes.js";
import manageAdminOrders from "./routes/admin/order.routes.js";

const app = express();
const httpServer = createServer(app);
const { PORT, DB_URI } = process.env;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

//middlewares
app.use(morgan("dev"));
app.use(express.json());
app.use(
  cors({
    // Allow the machine's own interfaces (Expo web/mobile on LAN), localhost dev
    // servers, and anything listed in CORS_ORIGINS. Computing the LAN IPs at
    // startup avoids stale hardcoded addresses breaking when the network changes.
    // In production set CORS_ORIGINS to your real domains.
    origin: (origin, callback) => {
      const allowed = new Set([
        "http://localhost:8081",        // Expo web (loopback)
        "http://127.0.0.1:8081",        // Expo web (ipv4)
        "http://localhost:5173",        // Vite admin client
        "http://localhost:5174",        // Vite admin client (alt port)
        "exp://192.168.254.181:8081",   // Expo Go (legacy dev client)
      ]);

      // The server host's own LAN IPs — covers http://<lan-ip>:8081 (Expo web)
      // and exp://<lan-ip>:8081 (Expo Go) for every interface of this machine.
      const nets = os.networkInterfaces();
      for (const addrs of Object.values(nets)) {
        for (const net of addrs ?? []) {
          if (net.family === "IPv4" && net.address) {
            allowed.add(`http://${net.address}:8081`);
            allowed.add(`http://${net.address}:19000`);
            allowed.add(`exp://${net.address}:8081`);
          }
        }
      }

      for (const extra of (process.env.CORS_ORIGINS ?? "").split(",")) {
        const trimmed = extra.trim();
        if (trimmed) allowed.add(trimmed);
      }

      // No Origin header = native apps / curl / same-origin — always allowed.
      if (!origin || allowed.has(origin)) return callback(null, true);

      // Any localhost port is allowed for dev convenience.
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true, // Required for Set-Cookie to be accepted cross-origin
  }),
);
app.use(cookieParser());

// Serve uploaded files (e.g. product images) at /uploads/...
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --------------------------------------------------
// Resolve stored relative image paths (/uploads/...) into absolute URLs
// based on the host each client used to reach the API. The DB keeps
// relative paths so the same document works for the web admin
// (http://localhost:5000), the mobile apps (e.g. http://192.168.x.x:5000),
// and any future deployment domain. Full URLs are left untouched.
// --------------------------------------------------
const resolveRelativeImages = (node, origin) => {
  if (Array.isArray(node)) {
    node.forEach((item) => resolveRelativeImages(item, origin));
  } else if (node && typeof node === "object") {
    // Mongoose documents expose internals ($__, _doc, etc.) that contain
    // circular parent references — walking them causes infinite recursion
    // (RangeError) and every populated endpoint 500s. Convert to plain JSON
    // first so we only ever walk real response data.
    if (node instanceof mongoose.Document) {
      node = node.toJSON({ depopulate: false });
    }
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (key === "image" && typeof value === "string" && value.startsWith("/uploads/")) {
        node[key] = origin + value;
      } else if (value && typeof value === "object") {
        resolveRelativeImages(value, origin);
      }
    }
  }
};

app.use((req, res, next) => {
  const send = res.json.bind(res);
  const origin = `${req.protocol}://${req.get("host")}`;
  res.json = (body) => {
    resolveRelativeImages(body, origin);
    return send(body);
  };
  next();
});

//manage by superadmin
app.use("/api/auth", authRoutes);
app.use("/api/superadmin/admins", auth, authorize("superadmin"), manageAdmins);
app.use(
  "/api/superadmin/branches",
  auth,
  authorize("superadmin"),
  manageBranches,
);
app.use("/api/superadmin/audit", auth, authorize("superadmin"), manageAudit);
app.use("/api/superadmin/profile", auth, authorize("superadmin"), manageProfile);
app.use("/api/superadmin/analytics", auth, authorize("superadmin"), manageAnalytics);
app.use("/api/superadmin/promos", auth, authorize("superadmin"), managePromos);

//manage by admin
app.use("/api/admin/riders", auth, authorize("admin", "superadmin"), manageRiders);
app.use("/api/admin/products", auth, authorize("admin", "superadmin"), manageProducts);
app.use("/api/admin/categories", auth, authorize("admin", "superadmin"), manageCategories);
app.use("/api/admin/customers", auth, authorize("admin"), manageCustomer);
app.use("/api/admin/analytics", auth, authorize("admin"), manageAdminAnalytics);
app.use(
  "/api/admin/branches",
  auth,
  authorize("admin"),
  manageAdminBranches,
);
app.use("/api/admin/profile", auth, authorize("admin"), manageAdminProfile);
app.use("/api/admin/orders", auth, authorize("admin", "superadmin"), manageAdminOrders);

//manage by customer
app.use("/api/customer/profile", auth, manageProfileCustomer);
app.use("/api/customer/products", auth, manageCustomerProducts);
app.use("/api/customer/promos", auth, manageCustomerPromos);
app.use("/api/customer/branches", auth, manageCustomerBranches);
app.use("/api/orders", auth, authorize("customer", "admin"), manageOrderItems);
app.use("/api/orders", auth, authorize("customer", "admin"), manageOrders);

// App settings (delivery fee etc.)
app.use("/api/settings", manageSettings);

// Chat (REST history endpoints — real-time handled by socket.io)
app.use("/api/chat", chatRoutes);

app.use("/api/admin/branch-inventory", auth, authorize("admin", "superadmin"), manageBranchInventory);

// Rider routes
app.use("/api/rider", auth, authorize("rider", "superadmin"), manageRiderRoutes);

mongoose
  .connect(DB_URI)
  .then(() => {
    initSocket(httpServer);
    httpServer.listen(PORT, () => {
      console.log(`Running on Port http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
  });
