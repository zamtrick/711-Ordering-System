import User from "../models/User.js";
import Customer from "../models/Customer.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { logAction } from "./superadmin/audit.controller.js";
import {
  issueOtp,
  verifyOtp,
  resendAvailableIn,
} from "../services/otp.service.js";
import { sendOtpEmail } from "../services/email.service.js";

export const register = async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already been used",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createUser = await User.create({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "customer",
      isActive: true,
      isVerified: false,
    });

    try {
      await Customer.create({ user: createUser._id });
    } catch (customerError) {
      await User.findByIdAndDelete(createUser._id);
      throw customerError;
    }

    // New accounts start unverified — issue the first code immediately.
    // Email failures must not fail registration (log-only mode in dev).
    try {
      const code = await issueOtp(normalizedEmail, "verify");
      await sendOtpEmail({
        to: normalizedEmail,
        name: createUser.firstname,
        code,
        purpose: "verify",
      });
    } catch (otpError) {
      console.error("Register OTP error:", otpError.message);
    }

    const token = jwt.sign(
      { userId: createUser._id, email: createUser.email, role: createUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: "Registered Successfully",
      data: {
        id: createUser._id,
        firstname: createUser.firstname,
        lastname: createUser.lastname,
        email: createUser.email,
        role: createUser.role,
        isVerified: createUser.isVerified,
        needsVerification: true,
      },
    });
  } catch (err) {
    console.error("Register error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: "Invalid Email or Password" });
    }

    const comparePassword = await bcrypt.compare(password, user.password);

    if (!comparePassword) {
      return res.status(401).json({ success: false, message: "Invalid Email or Password" });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: "Your account is inactive" });
    }

    // Unverified accounts can log in (browse) but cannot order until the
    // email is confirmed. The app routes these users to the OTP screen.
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email to continue.",
        email: user.email,
      });
    }

    const userResponse = {
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    };

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Audit log for superadmin login
    if (user.role === "superadmin") {
      logAction(user._id, "login", "auth", user._id, {
        email: normalizedEmail,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login Successfully",
      userResponse,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server Error" });
  }
};

export const logout = async (req, res) => {
  try {
    // Audit log for superadmin logout
    if (req.user && req.user.role === "superadmin") {
      logAction(req.user.userId, "logout", "auth", req.user.userId);
    }

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return res.status(200).json({ success: true, message: "Logout successful" });
  } catch (err) {
    console.error("Logout error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
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
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    console.error("Me error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ==========================================
// REQUEST VERIFICATION CODE (public)
// ==========================================
// Re-sends the registration OTP. Requires an existing, unverified account.
export const requestVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }
    if (user.isVerified) {
      return res.status(200).json({ success: true, message: "Email is already verified." });
    }

    const code = await issueOtp(normalizedEmail, "verify");
    await sendOtpEmail({
      to: normalizedEmail,
      name: user.firstname,
      code,
      purpose: "verify",
    });

    return res.status(200).json({
      success: true,
      message: "Verification code sent.",
      retryAfter: await resendAvailableIn(normalizedEmail, "verify"),
    });
  } catch (err) {
    return res
      .status(err.status ?? 500)
      .json({ success: false, message: err.message ?? "Internal Server Error" });
  }
};

// ==========================================
// CONFIRM VERIFICATION CODE (public)
// ==========================================
export const confirmVerificationCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: "Email and code are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    await verifyOtp(normalizedEmail, code, "verify");

    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: { isVerified: true } },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      data: { email: user.email, isVerified: true },
    });
  } catch (err) {
    return res
      .status(err.status ?? 500)
      .json({ success: false, message: err.message ?? "Internal Server Error" });
  }
};

// ==========================================
// FORGOT PASSWORD (public)
// ==========================================
// Always returns the same message so attackers can't probe registrations.
export const forgotPassword = async (req, res) => {
  const generic = "If this email is registered, a reset code has been sent.";

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      try {
        const code = await issueOtp(normalizedEmail, "reset");
        await sendOtpEmail({
          to: normalizedEmail,
          name: user.firstname,
          code,
          purpose: "reset",
        });
      } catch (otpError) {
        console.error("Forgot-password OTP error:", otpError.message);
      }
    }

    return res.status(200).json({ success: true, message: generic });
  } catch (err) {
    console.error("Forgot-password error:", err.message);
    return res.status(200).json({ success: true, message: generic });
  }
};

// ==========================================
// RESET PASSWORD (public)
// ==========================================
// Single step: the OTP itself authorizes the change, then dies.
export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, code and new password are required",
      });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    await verifyOtp(normalizedEmail, code, "reset");

    const hashed = await bcrypt.hash(String(newPassword), 10);
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: { password: hashed } },
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in.",
    });
  } catch (err) {
    return res
      .status(err.status ?? 500)
      .json({ success: false, message: err.message ?? "Internal Server Error" });
  }
};
