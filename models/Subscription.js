import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  subscription: {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: String,
      auth: String
    }
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
