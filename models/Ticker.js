import mongoose from "mongoose";

const tickerSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

export default mongoose.model("Ticker", tickerSchema);