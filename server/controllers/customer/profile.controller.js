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
// ADDRESS MANAGEMENT
// --------------------------------------------------

export const addAddress = async (req, res) => {
  try {
    const { label, address } = req.body;

    const customer = await Customer.findOne({ user: req.user.userId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Add new address
    customer.addresses.push({
      label: label || "Address",
      address,
      isDefault: customer.addresses.length === 0, // Set as default if first address
    });

    await customer.save();

    // Ensure only one default address
    if (customer.addresses.length > 1) {
      customer.addresses.forEach((addr, idx) => {
        if (idx !== customer.addresses.length - 1) {
          addr.isDefault = false;
        }
      });
      await customer.save();
    }

    const updated = await Customer.findById(customer._id).populate(
      "user",
      "firstname lastname email",
    );

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Add address error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, address, isDefault } = req.body;

    const customer = await Customer.findOne({ user: req.user.userId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    const addr = customer.addresses.find((a) => a._id.toString() === addressId);

    if (!addr) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (label !== undefined) addr.label = label;
    if (address !== undefined) addr.address = address;
    if (isDefault !== undefined) {
      // If setting this as default, clear other defaults
      customer.addresses.forEach((a) => {
        a.isDefault = a._id.toString() === addressId;
      });
    }

    await customer.save();

    const updated = await Customer.findById(customer._id).populate(
      "user",
      "firstname lastname email",
    );

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Update address error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const removeAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const customer = await Customer.findOne({ user: req.user.userId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    customer.addresses = customer.addresses.filter(
      (a) => a._id.toString() !== addressId,
    );

    // If removing the default address, set the first one as default
    if (customer.addresses.length === 0) {
      // No addresses left - this is fine, customer has none
    } else if (customer.addresses.length === 1) {
      customer.addresses[0].isDefault = true;
    }

    await customer.save();

    const updated = await Customer.findById(customer._id).populate(
      "user",
      "firstname lastname email",
    );

    return res.status(200).json({
      success: true,
      message: "Address removed successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Remove address error:", err.message);

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
    if (address !== undefined) {
      // If a single address string is provided, set it as the default address
      customer.addresses = [
        {
          label: "Default",
          address: String(address).trim(),
          isDefault: true,
        },
      ];
    }
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
