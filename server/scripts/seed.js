import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";
import Branch from "../models/Branch.js";

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);

    console.log("Connected to MongoDB");

    // --------------------------------------------------
    // SEED SUPERADMIN
    // --------------------------------------------------

    const existingSuperAdmin = await User.findOne({ role: "superadmin" });

    if (existingSuperAdmin) {
      console.log("Superadmin already exists — skipping");
    } else {
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
    }

    // --------------------------------------------------
    // SEED DEFAULT BRANCH
    // --------------------------------------------------

    const existingBranch = await Branch.findOne();

    if (existingBranch) {
      console.log("Branch already exists — skipping");
    } else {
      await Branch.create({
        name: "7-Eleven Main Branch",
        branchCode: "MAIN001",
        location: "Cebu City, Cebu",
        address: {
          street: "1 Colon Street",
          barangay: "Santo Niño",
          city: "Cebu City",
          province: "Cebu",
          postalCode: "6000",
        },
        paymentMethods: ["cash", "gcash", "maya"],
        contactNumber: "+63 32 123 4567",
        email: "mainbranch@711.com",
        status: "active",
        openingTime: "06:00",
        closingTime: "22:00",
      });

      console.log("Default branch created successfully");
    }
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
};

seed();
