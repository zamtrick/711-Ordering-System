import User from "../../models/User.js";
import Admin from "../../models/Admin.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { logAction } from "./audit.controller.js";
import { notifyAdminCreated } from "../../services/email.service.js";

/*
|--------------------------------------------------------------------------|
| GET ALL ADMINS
|--------------------------------------------------------------------------|
| Retrieves all Admin records and populates:
| - user           → Basic user information
| - assignedBranch → Branch assigned to the admin
|
| Password is excluded for security.
|--------------------------------------------------------------------------|
*/

export const getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find()
      .populate("user", "-password")
      .populate("assignedBranch")
      .sort({ createdAt: -1 });

    // If no admins exist
    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No admins found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admins retrieved successfully",
      admins,
    });
  } catch (err) {
    console.error("Get admins error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------|
| CREATE ADMIN
|--------------------------------------------------------------------------|
| Creates:
| 1. A User document → firstname, lastname, email, password, role
| 2. An Admin document → user reference + assigned branch
|
| The password is hashed before saving.
|--------------------------------------------------------------------------|
*/

export const createAdmin = async (req, res) => {
  try {
    const { firstname, lastname, email, password, assignedBranch } = req.body;

    // Check if all required fields are provided
    if (!firstname || !lastname || !email || !password || !assignedBranch) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate the assigned branch ID
    if (!mongoose.Types.ObjectId.isValid(assignedBranch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already registered
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already in use",
      });
    }

    // Hash the admin password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the User account
    const user = await User.create({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      isActive: true,
      // Superadmin-created accounts are trusted — no email OTP needed.
      isVerified: true,
    });

    try {
      // Create the Admin profile
      const admin = await Admin.create({
        user: user._id,
        assignedBranch,
      });

      // Audit log
      logAction(req.user.userId, "create_admin", "admin", admin._id, {
        name: `${firstname} ${lastname}`,
        email: normalizedEmail,
      });

      // Email notification (non-blocking)
      const branchDoc = await (await import("../../models/Branch.js")).default.findById(assignedBranch);
      notifyAdminCreated({
        name: `${firstname} ${lastname}`,
        email: normalizedEmail,
        branchName: branchDoc?.name || "Unknown",
        tempPassword: password,
      }).catch(() => {});

      // Return created admin information
      return res.status(201).json({
        success: true,
        message: "Admin created successfully",
        data: {
          id: admin._id,
          user: {
            id: user._id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          },
          assignedBranch: admin.assignedBranch,
        },
      });
    } catch (adminError) {
      // If Admin creation fails, remove the User
      // so we don't leave an orphaned User account.
      await User.findByIdAndDelete(user._id);

      throw adminError;
    }
  } catch (err) {
    console.error("Create admin error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------|
| GET ADMIN BY ID
|--------------------------------------------------------------------------|
| Retrieves a single Admin using the Admin document ID.
|
| Populates:
| - user
| - assignedBranch
|--------------------------------------------------------------------------|
*/

export const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate Admin ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    // Find admin and populate related documents
    const admin = await Admin.findById(id)
      .populate("user", "-password")
      .populate("assignedBranch");

    // Admin does not exist
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admin found",
      data: admin,
    });
  } catch (err) {
    console.error("Get admin error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------|
| UPDATE ADMIN
|--------------------------------------------------------------------------|
| Updates both:
|
| User:
| - firstname
| - lastname
| - email
| - password
| - isActive
|
| Admin:
| - assignedBranch
|--------------------------------------------------------------------------|
*/

export const updateAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    const { firstname, lastname, email, password, isActive, assignedBranch } =
      req.body;

    // Validate Admin ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    // Find the Admin profile
    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Find the associated User
    const user = await User.findById(admin.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Associated user not found",
      });
    }

    // Track changes for audit log
    const changes = {};

    /*
    |--------------------------------------------------------------------------|
    | UPDATE USER INFORMATION
    |--------------------------------------------------------------------------|
    */

    // Update first name if provided
    if (firstname !== undefined) {
      user.firstname = firstname.trim();
      changes.firstname = firstname.trim();
    }

    // Update last name if provided
    if (lastname !== undefined) {
      user.lastname = lastname.trim();
      changes.lastname = lastname.trim();
    }

    // Update email if provided
    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      // Check if another user is already using this email
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email is already in use",
        });
      }

      user.email = normalizedEmail;
      changes.email = normalizedEmail;
    }

    // Update active status
    if (isActive !== undefined) {
      user.isActive = isActive;
      changes.isActive = isActive;
    }

    // Update password only if a new password was provided
    if (password) {
      user.password = await bcrypt.hash(password, 10);
      changes.passwordChanged = true;
    }

    /*
    |--------------------------------------------------------------------------|
    | UPDATE ADMIN INFORMATION
    |--------------------------------------------------------------------------|
    */

    // Update assigned branch
    if (assignedBranch !== undefined) {
      // Validate branch ID
      if (!mongoose.Types.ObjectId.isValid(assignedBranch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      admin.assignedBranch = assignedBranch;
      changes.assignedBranch = assignedBranch;
    }

    // Save User changes
    await user.save();

    // Save Admin changes
    await admin.save();

    // Audit log
    logAction(req.user.userId, "update_admin", "admin", admin._id, changes);

    // Return updated admin
    const updatedAdmin = await Admin.findById(admin._id)
      .populate("user", "-password")
      .populate("assignedBranch");

    return res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: updatedAdmin,
    });
  } catch (err) {
    console.error("Update admin error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------|
| DELETE ADMIN
|--------------------------------------------------------------------------|
| Deletes:
| 1. Admin profile
| 2. Associated User account
|
| This prevents an orphaned User document from remaining in the database.
|--------------------------------------------------------------------------|
*/

export const deleteAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate Admin ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    // Find Admin profile
    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Get admin name for audit log before deleting
    const adminUser = await User.findById(admin.user).select("firstname lastname email");

    // Delete the associated User account
    await User.findByIdAndDelete(admin.user);

    // Delete the Admin profile
    await Admin.findByIdAndDelete(id);

    // Audit log
    logAction(req.user.userId, "delete_admin", "admin", id, {
      name: adminUser ? `${adminUser.firstname} ${adminUser.lastname}` : "Unknown",
      email: adminUser?.email,
    });

    return res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (err) {
    console.error("Delete admin error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
