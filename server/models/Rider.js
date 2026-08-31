import mongoose from "mongoose";

const riderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    assignedBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
    },
    vehicleType: {
      type: String,
      required: true,
    },
    vehiclePlateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    availabilityStatus: {
      type: String,
      enum: ["available", "offline", "delivering"],
      default: "offline",
    },
  },
  { timestamps: true },
);

const Rider = mongoose.model("Rider", riderSchema);

export default Rider;
