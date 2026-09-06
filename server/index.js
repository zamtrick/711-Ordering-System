//packages
import express from "express";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

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
import manageRiderRoutes from "./routes/rider/rider.routes.js";

dotenv.config();
const app = express();
const { PORT, DB_URI } = process.env;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

//middlewares
app.use(morgan("dev"));
app.use(express.json());
app.use(
  cors({
    // Allow the mobile app's LAN origin and the web admin client.
    // In production replace these with your real domains.
    origin: [
      "http://192.168.254.181:8081", // Expo dev client (same LAN)
      "http://localhost:8081",        // Expo web
      "http://localhost:5173",        // Vite superadmin
      "http://localhost:5174",        // Vite admin
    ],
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

//manage by admin
app.use("/api/admin/riders", auth, authorize("admin"), manageRiders);
app.use("/api/admin/products", auth, authorize("admin"), manageProducts);
app.use("/api/admin/categories", auth, authorize("admin"), manageCategories);
app.use("/api/admin/customers", auth, authorize("admin"), manageCustomer);
app.use("/api/admin/analytics", auth, authorize("admin"), manageAdminAnalytics);
app.use(
  "/api/admin/branches",
  auth,
  authorize("admin"),
  manageAdminBranches,
);
app.use("/api/admin/profile", auth, authorize("admin"), manageAdminProfile);

//manage by customer
app.use("/api/customer/profile", auth, manageProfileCustomer);
app.use("/api/customer/products", auth, manageCustomerProducts);
app.use("/api/customer/branches", auth, manageCustomerBranches);
app.use("/api/orders", auth, authorize("customer", "admin"), manageOrderItems);
app.use("/api/orders", auth, authorize("customer", "admin"), manageOrders);

// Rider routes
app.use("/api/rider", auth, authorize("rider", "superadmin"), manageRiderRoutes);

mongoose
  .connect(DB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Running on Port http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
  });
