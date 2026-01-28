import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["staff", "approver", "admin"],
      required: true,
    },
    department: { type: String },
    level: { 
  type: Number, 
  required: function() { return this.role === "approver"; } 
},
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true } // ⏰ Auto add createdAt & updatedAt
);

// 🔑 Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
};

// ✅ Cun-cun export untuk elak OverwriteModelError
const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
