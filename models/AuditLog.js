import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    action: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    module: {
      type: String, // contoh: AUTH, USER, REQUEST
    },

    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);