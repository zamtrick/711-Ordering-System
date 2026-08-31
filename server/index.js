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

dotenv.config();
const app = express();
const { PORT, DB_URI } = process.env;

//middlewares
app.use(morgan("dev"));
app.use(express.json());
app.use(cors());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/superadmin", auth, authorize("superadmin "), manageAdmins);
app.use("/api/superadmin", auth, authorize("superadmin "), manageBranches);

app.use("/api/admin", auth, authorize("admin"));
app.use("/api/admin", auth, authorize("admin"), manageProducts);
app.use("/api/admin", auth, authorize("admin"), manageCategories);

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
