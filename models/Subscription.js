import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    role: {
      type: String,
      enum: ["technician", "approver", "admin"],
      required: true
    },

    deviceId: {
      type: String,
      required: true
    },

    subscription: {
      endpoint: {
        type: String,
        required: true
      },
      keys: {
        p256dh: String,
        auth: String
      }
    }
  },
  { timestamps: true }
);

// 🔥 prevent duplicate per device
subscriptionSchema.index(
  { userId: 1, role: 1, deviceId: 1 },
  { unique: true }
);

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
