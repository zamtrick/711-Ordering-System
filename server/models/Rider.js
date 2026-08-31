import mongoose from "mongoose";

const riderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
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
      type: string,
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
      required: true,
      enum: ["available", "offline", "delivering"],
      default: "available",
    },
  },
  { timestamps: true },
);

const Rider = mongoose.model("Rider", riderSchema);

export default Rider;
