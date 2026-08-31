import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All field is required" });
    }

    const user = await User.findOne({ email });

    if (user) {
      return res
        .status(409)
        .json({ success: false, message: "Email is already been used" });
    }

    const salt = 10;
    const hashedPassword = await bcrypt.hash(password, salt);

    const createUser = await User.create({
      firstname,
      lastname,
      email,
      password: hashedPassword,
    });

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

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: "Registered Successfully",
      data: createUser,
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All field is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid Email or Password" });
    }

    const comparePassword = await bcrypt.compare(password, user.password);

    if (!comparePassword) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid Email or Password" });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    const userResponse = {
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(
      {
        userId: userResponse.id,
        email: userResponse.email,
        role: userResponse.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res
      .status(200)
      .json({ success: true, message: "Login Successfully", userResponse });
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server Error" });
  }
};

export const logout = async (req, res) => {
  try {
    //clear cookie
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    //response
    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
