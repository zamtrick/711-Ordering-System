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

dotenv.config();
const app = express();
const { PORT, DB_URI } = process.env;

//middlewares
app.use(morgan("dev"));
app.use(express.json());
app.use(cors());
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

app.get("/api/profile", auth, (req, res) => {
  res.status(200).json({ message: "WELCOME TO PROFILE PAGE" });
});

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
