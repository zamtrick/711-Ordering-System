import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../../models/User.js";
import Rider from "../../models/Rider.js";
import { notifyRiderCreated } from "../../services/email.service.js";
import Branch from "../../models/Branch.js";

// Maps common Mongoose errors to proper 4xx responses instead of a bare 500
const handleRiderError = (err, res) => {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ success: false, message: `Rider ${field} already exists` });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: Object.values(err.errors)[0]?.message ?? "Invalid rider data" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid rider ID" });
  }
  console.error(err.message);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

/*
|--------------------------------------------------------------------------
| GET ALL RIDERS
|--------------------------------------------------------------------------
| Get all riders with their User and Branch information.
|--------------------------------------------------------------------------
*/

export const getRiders = async (req, res) => {
  try {
    const riders = await Rider.find()
      .populate("user", "-password")
      .populate("assignedBranch")
      .sort({ createdAt: -1 });

    // An empty list is a valid 200 — the UI shows its own empty state.
    // (A 404 here made the client fire a false "Failed to load" toast.)

    return res.status(200).json({
      success: true,
      message: "Riders retrieved successfully",
      riders,
    });
  } catch (err) {
    console.error("Get riders error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET RIDER BY ID
|--------------------------------------------------------------------------
| Get a specific rider using the Rider document ID.
|--------------------------------------------------------------------------
*/

export const getRiderById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if Rider ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    const rider = await Rider.findById(id)
      .populate("user", "-password")
      .populate("assignedBranch");

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rider found",
      data: rider,
    });
  } catch (err) {
    console.error("Get rider error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| CREATE RIDER
|--------------------------------------------------------------------------
| Creates:
|
| 1. User account
| 2. Rider profile
|
| User:
| - firstname
| - lastname
| - email
| - password
| - role
|
| Rider:
| - user
| - assignedBranch
| - phone
| - address
| - age
| - vehicleType
| - vehiclePlateNumber
| - availabilityStatus
|--------------------------------------------------------------------------
*/

export const createRider = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      password,
      assignedBranch,
      phone,
      address,
      age,
      vehicleType,
      vehiclePlateNumber,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE REQUIRED FIELDS
    |--------------------------------------------------------------------------
    */

    if (
      !firstname ||
      !lastname ||
      !email ||
      !password ||
      !assignedBranch ||
      !phone ||
      !address ||
      age === undefined ||
      !vehicleType ||
      !vehiclePlateNumber
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE AGE
    |--------------------------------------------------------------------------
    */

    if (age < 18) {
      return res.status(400).json({
        success: false,
        message: "Rider must be at least 18 years old",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE BRANCH ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(assignedBranch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK IF BRANCH EXISTS
    |--------------------------------------------------------------------------
    */

    const branch = await Branch.findById(assignedBranch);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
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
    | CHECK VEHICLE PLATE NUMBER
    |--------------------------------------------------------------------------
    */

    const normalizedPlateNumber = vehiclePlateNumber.trim().toUpperCase();

    const existingPlate = await Rider.findOne({
      vehiclePlateNumber: normalizedPlateNumber,
    });

    if (existingPlate) {
      return res.status(409).json({
        success: false,
        message: "Vehicle plate number is already registered",
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
      role: "rider",
      isActive: true,
    });

    try {
      /*
      |--------------------------------------------------------------------------
      | CREATE RIDER PROFILE
      |--------------------------------------------------------------------------
      */

      const rider = await Rider.create({
        user: user._id,
        assignedBranch,
        phone: phone.trim(),
        address: address.trim(),
        age,
        vehicleType: vehicleType.trim(),
        vehiclePlateNumber: normalizedPlateNumber,
        availabilityStatus: "offline",
      });

      /*
      |--------------------------------------------------------------------------
      | RETURN CREATED RIDER
      |--------------------------------------------------------------------------
      */      const createdRider = await Rider.findById(rider._id)
        .populate("user", "-password")
        .populate("assignedBranch");

      /* Email notification (non-blocking) */
      notifyRiderCreated({
        name: `${firstname} ${lastname}`,
        email: normalizedEmail,
        tempPassword: password,
      }).catch(() => {});

      return res.status(201).json({
        success: true,
        message: "Rider created successfully",
        data: createdRider,
      });
    } catch (riderError) {
      /*
      |--------------------------------------------------------------------------
      | ROLLBACK USER
      |--------------------------------------------------------------------------
      | If Rider creation fails after User creation,
      | delete the User so we don't leave an orphaned account.
      |--------------------------------------------------------------------------
      */

      await User.findByIdAndDelete(user._id);

      throw riderError;
    }
  } catch (err) {
    return handleRiderError(err, res);
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE RIDER
|--------------------------------------------------------------------------
| Updates both User and Rider information.
|--------------------------------------------------------------------------
*/

export const updateRiderById = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      firstname,
      lastname,
      email,
      password,
      isActive,
      assignedBranch,
      phone,
      address,
      age,
      vehicleType,
      vehiclePlateNumber,
      availabilityStatus,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE RIDER ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND RIDER
    |--------------------------------------------------------------------------
    */

    const rider = await Rider.findById(id);

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND ASSOCIATED USER
    |--------------------------------------------------------------------------
    */

    const user = await User.findById(rider.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Associated user not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE USER INFORMATION
    |--------------------------------------------------------------------------
    */

    if (firstname !== undefined) {
      user.firstname = firstname.trim();
    }

    if (lastname !== undefined) {
      user.lastname = lastname.trim();
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
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE BRANCH
    |--------------------------------------------------------------------------
    */

    if (assignedBranch !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(assignedBranch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      const branch = await Branch.findById(assignedBranch);

      if (!branch) {
        return res.status(404).json({
          success: false,
          message: "Branch not found",
        });
      }

      rider.assignedBranch = assignedBranch;
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE PHONE
    |--------------------------------------------------------------------------
    */

    if (phone !== undefined) {
      rider.phone = phone.trim();
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE ADDRESS
    |--------------------------------------------------------------------------
    */

    if (address !== undefined) {
      rider.address = address.trim();
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE AGE
    |--------------------------------------------------------------------------
    */

    if (age !== undefined) {
      if (age < 18) {
        return res.status(400).json({
          success: false,
          message: "Rider must be at least 18 years old",
        });
      }

      rider.age = age;
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE VEHICLE TYPE
    |--------------------------------------------------------------------------
    */

    if (vehicleType !== undefined) {
      rider.vehicleType = vehicleType.trim();
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE VEHICLE PLATE NUMBER
    |--------------------------------------------------------------------------
    */

    if (vehiclePlateNumber !== undefined) {
      const normalizedPlateNumber = vehiclePlateNumber.trim().toUpperCase();

      const existingPlate = await Rider.findOne({
        vehiclePlateNumber: normalizedPlateNumber,
        _id: { $ne: rider._id },
      });

      if (existingPlate) {
        return res.status(409).json({
          success: false,
          message: "Vehicle plate number is already registered",
        });
      }

      rider.vehiclePlateNumber = normalizedPlateNumber;
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE AVAILABILITY STATUS
    |--------------------------------------------------------------------------
    */

    if (availabilityStatus !== undefined) {
      if (
        !["available", "offline", "delivering"].includes(availabilityStatus)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid availability status",
        });
      }

      rider.availabilityStatus = availabilityStatus;
    }

    /*
    |--------------------------------------------------------------------------
    | SAVE CHANGES
    |--------------------------------------------------------------------------
    */

    await user.save();
    await rider.save();

    /*
    |--------------------------------------------------------------------------
    | GET UPDATED RIDER
    |--------------------------------------------------------------------------
    */

    const updatedRider = await Rider.findById(rider._id)
      .populate("user", "-password")
      .populate("assignedBranch");

    return res.status(200).json({
      success: true,
      message: "Rider updated successfully",
      data: updatedRider,
    });
  } catch (err) {
    console.error("Update rider error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE RIDER
|--------------------------------------------------------------------------
| Deletes:
|
| 1. Rider profile
| 2. Associated User account
|
| This prevents orphaned User records.
|--------------------------------------------------------------------------
*/

export const deleteRiderById = async (req, res) => {
  try {
    const { id } = req.params;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE RIDER ID
    |--------------------------------------------------------------------------
    */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND RIDER
    |--------------------------------------------------------------------------
    */

    const rider = await Rider.findById(id);

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE USER ACCOUNT
    |--------------------------------------------------------------------------
    */

    await User.findByIdAndDelete(rider.user);

    /*
    |--------------------------------------------------------------------------
    | DELETE RIDER PROFILE
    |--------------------------------------------------------------------------
    */

    await Rider.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Rider deleted successfully",
    });
  } catch (err) {
    console.error("Delete rider error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
