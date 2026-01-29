// models/Request.js
import mongoose from "mongoose";

// ================= Approval Schema =================
const approvalSchema = new mongoose.Schema({
  level: { type: Number, required: true },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approverName: { type: String, default: "-" },
  approverDepartment: { type: String, default: "-" },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  remark: { type: String, default: "" },
  signature: { type: String, default: null },
  actionDate: { type: Date, default: null },
});

// ================= Items Schema FIXED =================
const itemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  estimatedCost: { type: Number, default: 0 },
  supplier: { type: String, default: "" },
  reason: { type: String, default: "" },
});

// ================= Request Schema FIXED + serialNumber =================
const requestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    staffName: { type: String, required: true },
    staffDepartment: { type: String, default: "-" },
    requestType: {
      type: String,
      enum: ["CUTI", "PEMBELIAN", "IT_SUPPORT", "Maintenance"],
      required: true,
    },
    details: { type: mongoose.Schema.Types.Mixed, required: true },

    leaveStart: { type: Date, default: null },
    leaveEnd: { type: Date, default: null },
    leaveDate: { type: Date, default: null },

    items: [itemSchema],
    approvals: [approvalSchema],

    file: { type: String, default: null }, // legacy
    signatureStaff: { type: String, default: null },

    attachments: [
  {
    originalName: { type: String, default: null },
    fileName: { type: String, default: null },
    fileUrl: { type: String, default: null }, // <-- penting supabase URL
    mimetype: { type: String, default: null },
    size: { type: Number, default: 0 },
  }
],


    finalStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },

    serialNumber: { type: String, unique: true, required: true }, // <-- bossskurrr tambah nie
  },
  { timestamps: true }
);

export default mongoose.model("Request", requestSchema);

