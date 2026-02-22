import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["staff", "approver", "admin", "technician"],
      required: true,
    },
    department: { type: String },
    level: { 
      type: Number, 
      required: function() { 
        // level wajib hanya untuk approver
        return this.role === "approver"; 
      } 
    },
    phone: { 
      type: String, 
      required: false, // ✅ now optional for all roles
      unique: true,
      validate: {
        validator: function(v) {
          // jika kosong, okay; kalau ada, kena format +60123456789
          return !v || /^\+\d{9,15}$/.test(v);
        },
        message: props => `${props.value} bukan nombor telefon yang sah! Gunakan format +60123456789`
      }
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