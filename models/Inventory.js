// models/Inventory.js
import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: "General" },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: "pcs" },
  minStock: { type: Number, default: 5 }
}, { timestamps: true });

export default mongoose.model("Inventory", inventorySchema);