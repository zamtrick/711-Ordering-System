import User from "../../models/User.js";
import bcrypt from "bcryptjs";
import { logAction } from "../superadmin/audit.controller.js";

// ==========================================
// GET MY PROFILE (Admin)
// ==========================================
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("Get profile error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// UPDATE MY PROFILE (Admin)
// ==========================================
export const updateMyProfile = async (req, res) => {
  try {
    const { firstname, lastname, email, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const changes = {};

    if (firstname !== undefined) {
      user.firstname = firstname.trim();
      changes.firstname = firstname.trim();
    }

    if (lastname !== undefined) {
      user.lastname = lastname.trim();
      changes.lastname = lastname.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

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

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set a new password",
        });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      changes.passwordChanged = true;
    }

    await user.save();

    logAction(req.user.userId, "update_profile", "profile", user._id, changes);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("Update profile error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
