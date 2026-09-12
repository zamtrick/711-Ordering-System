import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../../models/User.js";
import Customer from "../../models/Customer.js";

// Maps common Mongoose errors to proper 4xx responses instead of a bare 500
const handleCustomerError = (err, res) => {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ success: false, message: `Customer ${field} already exists` });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: Object.values(err.errors)[0]?.message ?? "Invalid customer data" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid customer ID" });
  }
  console.error(err.message);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

/*
|--------------------------------------------------------------------------
| GET ALL CUSTOMERS
|--------------------------------------------------------------------------
| Retrieves all customers.
|
| Populates:
| - user → firstname, lastname, email
|
| Customers are sorted from newest to oldest.
|--------------------------------------------------------------------------
*/

export const getCustomers = async (req, res) => {
  try {
    // Get all customers and populate User information
    const customers = await Customer.find()
      .populate("user", "firstname lastname email isActive")
      .sort({ createdAt: -1 });

    // An empty list is a valid 200 — the UI shows its own empty state.
    // (A 404 here made the client fire a false "Failed to load" toast.)

    // Return all customers
    return res.status(200).json({
      success: true,
      message: "Customers retrieved successfully",
      customers,
    });
  } catch (err) {
    console.error("Get customers error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET CUSTOMER BY ID
|--------------------------------------------------------------------------
| Retrieves a single customer using the Customer document ID.
|--------------------------------------------------------------------------
*/

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate Customer ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    // Find customer and populate User information
    const customer = await Customer.findById(id).populate(
      "user",
      "firstname lastname email isActive",
    );

    // Check if customer exists
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer found",
      data: customer,
    });
  } catch (err) {
    console.error("Get customer error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| CREATE CUSTOMER
|--------------------------------------------------------------------------
| Creates:
|
| 1. User account
| 2. Customer profile
|
| User:
| - firstname
| - lastname
| - email
| - password
| - role
|
| Customer:
| - user
|--------------------------------------------------------------------------
*/

export const createCustomer = async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE REQUIRED FIELDS
    |--------------------------------------------------------------------------
    */

    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE EMAIL
    |--------------------------------------------------------------------------
    */

    const normalizedEmail = email.trim().toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | CHECK IF EMAIL ALREADY EXISTS
    |--------------------------------------------------------------------------
    */

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already in use",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | HASH PASSWORD
    |--------------------------------------------------------------------------
    */

    const hashedPassword = await bcrypt.hash(password, 10);

    /*
    |--------------------------------------------------------------------------
    | CREATE USER ACCOUNT
    |--------------------------------------------------------------------------
    */

    const user = await User.create({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: normalizedEmail,
      password: hashedPassword,

      // Customers created through this controller
      // will always have the customer role.
      role: "customer",

      isActive: true,
      // Admin-created accounts are trusted — no email OTP needed.
      isVerified: true,
    });

    try {
      /*
      |--------------------------------------------------------------------------
      | CREATE CUSTOMER PROFILE
      |--------------------------------------------------------------------------
      */

      const customer = await Customer.create({
        user: user._id,
      });

      /*
      |--------------------------------------------------------------------------
      | GET CREATED CUSTOMER
      |--------------------------------------------------------------------------
      */

      const createdCustomer = await Customer.findById(customer._id).populate(
        "user",
        "firstname lastname email",
      );

      return res.status(201).json({
        success: true,
        message: "Customer created successfully",
        data: createdCustomer,
      });
    } catch (customerError) {
      /*
      |--------------------------------------------------------------------------
      | ROLLBACK USER
      |--------------------------------------------------------------------------
      | If Customer creation fails, delete the User account
      | to avoid leaving an orphaned User document.
      |--------------------------------------------------------------------------
      */

      await User.findByIdAndDelete(user._id);

      throw customerError;
    }
  } catch (err) {
    return handleCustomerError(err, res);
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE CUSTOMER
|--------------------------------------------------------------------------
| Updates both:
|
| User:
| - firstname
| - lastname
| - email
| - password
| - isActive
|
| Customer:
| - customer-specific fields can be added here later
|--------------------------------------------------------------------------
*/

export const updateCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const { firstname, lastname, email, password, isActive } = req.body;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE CUSTOMER ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND CUSTOMER
    |--------------------------------------------------------------------------
    */

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND ASSOCIATED USER
    |--------------------------------------------------------------------------
    */

    const user = await User.findById(customer.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Associated user not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE FIRST NAME
    |--------------------------------------------------------------------------
    */

    if (firstname !== undefined) {
      user.firstname = firstname.trim();
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE LAST NAME
    |--------------------------------------------------------------------------
    */

    if (lastname !== undefined) {
      user.lastname = lastname.trim();
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE EMAIL
    |--------------------------------------------------------------------------
    */

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
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE PASSWORD
    |--------------------------------------------------------------------------
    */

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */

    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    /*
    |--------------------------------------------------------------------------
    | SAVE USER
    |--------------------------------------------------------------------------
    */

    await user.save();

    /*
    |--------------------------------------------------------------------------
    | SAVE CUSTOMER
    |--------------------------------------------------------------------------
    | This is included so any future Customer-specific fields
    | can be saved here.
    |--------------------------------------------------------------------------
    */

    await customer.save();

    /*
    |--------------------------------------------------------------------------
    | GET UPDATED CUSTOMER
    |--------------------------------------------------------------------------
    */

    const updatedCustomer = await Customer.findById(customer._id).populate(
      "user",
      "firstname lastname email",
    );

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: updatedCustomer,
    });
  } catch (err) {
    console.error("Update customer error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| TOGGLE CUSTOMER STATUS
|--------------------------------------------------------------------------
| Activates or deactivates the customer's User account.
|
| This is preferable to deleting the customer when you only
| want to prevent the customer from logging in.
|--------------------------------------------------------------------------
*/

export const toggleCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE CUSTOMER ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND CUSTOMER
    |--------------------------------------------------------------------------
    */

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND ASSOCIATED USER
    |--------------------------------------------------------------------------
    */

    const user = await User.findById(customer.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Associated user not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | TOGGLE ACTIVE STATUS
    |--------------------------------------------------------------------------
    */

    user.isActive = !user.isActive;

    await user.save();

    return res.status(200).json({
      success: true,
      message: user.isActive
        ? "Customer activated successfully"
        : "Customer deactivated successfully",
      isActive: user.isActive,
    });
  } catch (err) {
    console.error("Toggle customer status error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE CUSTOMER
|--------------------------------------------------------------------------
| Deletes:
|
| 1. Customer profile
| 2. Associated User account
|
| This prevents orphaned User documents.
|--------------------------------------------------------------------------
*/

export const deleteCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE CUSTOMER ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND CUSTOMER
    |--------------------------------------------------------------------------
    */

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE USER ACCOUNT
    |--------------------------------------------------------------------------
    */

    await User.findByIdAndDelete(customer.user);

    /*
    |--------------------------------------------------------------------------
    | DELETE CUSTOMER PROFILE
    |--------------------------------------------------------------------------
    */

    await Customer.findByIdAndDelete(customer._id);

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (err) {
    console.error("Delete customer error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
