//packages
import express from "express";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import auth from "./middlewares/auth.middleware.js";
import { authorize } from "./middlewares/role.middleware.js";

import manageBranches from "./routes/superadmin/branch.routes.js";
import manageAdmins from "./routes/superadmin/admin.routes.js";
import manageProducts from "./routes/admin/product.routes.js";
import manageCategories from "./routes/admin/category.routes.js";
import manageRiders from "./routes/admin/rider.routes.js";
import manageCustomer from "./routes/admin/customer.routes.js";
import manageOrderItems from "./routes/customer/orderItem.routes.js";
import manageOrders from "./routes/customer/order.routes.js";
import manageProfileCustomer from "./routes/profile.routes.js";
import manageCustomerProducts from "./routes/customer/product.routes.js";
import manageCustomerBranches from "./routes/customer/branch.routes.js";

dotenv.config();
const app = express();
const { PORT, DB_URI } = process.env;

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
      "http://localhost:5173",        // Vite web admin
    ],
    credentials: true, // Required for Set-Cookie to be accepted cross-origin
  }),
);
app.use(cookieParser());

//manage by supeadmin
app.use("/api/auth", authRoutes);
app.use("/api/superadmin/admins", auth, authorize("superadmin"), manageAdmins);
app.use(
  "/api/superadmin/branches",
  auth,
  authorize("superadmin"),
  manageBranches,
);

//manage by admin
app.use("/api/admin/riders", auth, authorize("admin"), manageRiders);
app.use("/api/admin/products", auth, authorize("admin"), manageProducts);
app.use("/api/admin/categories", auth, authorize("admin"), manageCategories);
app.use("/api/admin/customers", auth, authorize("admin"), manageCustomer);

//manage by customer
app.use("/api/customer/profile", auth, manageProfileCustomer);
app.use("/api/customer/products", auth, manageCustomerProducts);
app.use("/api/customer/branches", auth, manageCustomerBranches);
app.use("/api/orders", auth, authorize("customer", "admin"), manageOrderItems);
app.use("/api/orders", auth, authorize("customer", "admin"), manageOrders);

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
