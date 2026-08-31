import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);

    console.log("Connected to MongoDB");

    const existingSuperAdmin = await User.findOne({
      role: "superadmin",
    });

    if (existingSuperAdmin) {
      console.log("Superadmin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      process.env.SUPERADMIN_PASSWORD,
      10,
    );

    await User.create({
      firstname: process.env.SUPERADMIN_FIRSTNAME,
      lastname: process.env.SUPERADMIN_LASTNAME,
      email: process.env.SUPERADMIN_EMAIL,
      password: hashedPassword,
      role: "superadmin",
      isActive: true,
    });

    console.log("Superadmin created successfully");
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
};

seed();
