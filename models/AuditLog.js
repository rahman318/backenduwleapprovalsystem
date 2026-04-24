// models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  action: String, // CREATE, UPDATE, DELETE, LOGIN
  module: String, // REQUEST, USER, AUTH
  performedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    email: String,
    role: String,
  },
  targetId: String, // contoh requestId
  details: Object, // BEFORE / AFTER / extra info
  ipAddress: String,
  userAgent: String,
}, { timestamps: true });

export default mongoose.model("AuditLog", auditLogSchema);
