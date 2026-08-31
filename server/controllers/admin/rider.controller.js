import Rider from "../../models/Rider.js";

export const getRiders = async (req, res) => {
  try {
  } catch (err) {
    console.error(err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
