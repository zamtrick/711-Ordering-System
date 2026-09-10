import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    // The user who sent this message
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // "customer" | "admin" — stored so the UI can style without extra populates
    senderRole: {
      type: String,
      enum: ["customer", "admin"],
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Whether the other party has read this message
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
