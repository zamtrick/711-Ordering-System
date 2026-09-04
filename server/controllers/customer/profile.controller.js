import Customer from "../../models/Customer.js";
import User from "../../models/User.js";

// --------------------------------------------------
// GET MY PROFILE
// --------------------------------------------------

export const getMyProfile = async (req, res) => {
  try {
    // JWT payload uses `userId`, not `_id`
    const customer = await Customer.findOne({ user: req.user.userId }).populate(
      "user",
      "firstname lastname email",
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: customer,
    });
  } catch (err) {
    console.error("Get my profile error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// --------------------------------------------------
// UPDATE MY PROFILE
// --------------------------------------------------

export const updateMyProfile = async (req, res) => {
  try {
    const { firstname, lastname, phone, address, age } = req.body;

    // Find the customer doc
    const customer = await Customer.findOne({ user: req.user.userId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Update Customer-level fields
    if (phone !== undefined) customer.phone = String(phone).trim();
    if (address !== undefined) customer.address = String(address).trim();
    if (age !== undefined) customer.age = String(age).trim();
    await customer.save();

    // Update User-level fields (name only — email/password are separate)
    if (firstname !== undefined || lastname !== undefined) {
      const user = await User.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (firstname !== undefined) user.firstname = firstname.trim();
      if (lastname !== undefined) user.lastname = lastname.trim();
      await user.save();
    }

    // Return updated profile with populated user fields
    const updated = await Customer.findById(customer._id).populate(
      "user",
      "firstname lastname email",
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Update my profile error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
