import User from "../models/User.js";
import Customer from "../models/Customer.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    // --------------------------------------------------
    // VALIDATE REQUIRED FIELDS
    // --------------------------------------------------
    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // --------------------------------------------------
    // NORMALIZE INPUT
    // --------------------------------------------------
    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------
    // CHECK IF EMAIL ALREADY EXISTS
    // --------------------------------------------------
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already been used",
      });
    }

    // --------------------------------------------------
    // HASH PASSWORD
    // --------------------------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // --------------------------------------------------
    // CREATE USER
    // --------------------------------------------------
    const createUser = await User.create({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: normalizedEmail,
      password: hashedPassword,

      // This registration endpoint is for customers
      role: "customer",

      isActive: true,
    });

    // --------------------------------------------------
    // CREATE CUSTOMER PROFILE
    // --------------------------------------------------
    try {
      await Customer.create({
        user: createUser._id,
      });
    } catch (customerError) {
      // If Customer creation fails,
      // remove the User to prevent an orphaned User.
      await User.findByIdAndDelete(createUser._id);

      throw customerError;
    }

    // --------------------------------------------------
    // CREATE JWT
    // --------------------------------------------------
    const token = jwt.sign(
      {
        userId: createUser._id,
        email: createUser.email,
        role: createUser.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    // --------------------------------------------------
    // SET COOKIE
    // --------------------------------------------------
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------
    return res.status(201).json({
      success: true,
      message: "Registered Successfully",
      data: {
        id: createUser._id,
        firstname: createUser.firstname,
        lastname: createUser.lastname,
        email: createUser.email,
        role: createUser.role,
      },
    });
  } catch (err) {
    console.error("Register error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // --------------------------------------------------
    // VALIDATE REQUIRED FIELDS
    // --------------------------------------------------
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // --------------------------------------------------
    // NORMALIZE EMAIL
    // --------------------------------------------------
    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------
    // FIND USER
    // --------------------------------------------------
    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid Email or Password",
      });
    }

    // --------------------------------------------------
    // CHECK PASSWORD
    // --------------------------------------------------
    const comparePassword = await bcrypt.compare(password, user.password);

    if (!comparePassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid Email or Password",
      });
    }

    // --------------------------------------------------
    // CHECK ACCOUNT STATUS
    // --------------------------------------------------
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // --------------------------------------------------
    // USER RESPONSE
    // --------------------------------------------------
    const userResponse = {
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
    };

    // --------------------------------------------------
    // CREATE JWT
    // --------------------------------------------------
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    // --------------------------------------------------
    // SET COOKIE
    // --------------------------------------------------
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------
    return res.status(200).json({
      success: true,
      message: "Login Successfully",
      userResponse,
    });
  } catch (err) {
    console.error("Login error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal server Error",
    });
  }
};

export const logout = async (req, res) => {
  try {
    // Clear cookie
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (err) {
    console.error("Logout error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
