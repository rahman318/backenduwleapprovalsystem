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

// ================= Items Schema =================
const itemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  estimatedCost: { type: Number, default: 0 },
  supplier: { type: String, default: "" },
  reason: { type: String, default: "" },
});

// ================= Request Schema =================
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
    url: { type: String, default: null }, // wajib untuk public URL
    mimetype: { type: String, default: null },
    size: { type: Number, default: 0 },
  },
],

        // ================= Maintenance Flow =================
    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: { 
      type: Date, 
      default: null 
    }, // <--- BARU (untuk kira SLA)
    slaHours: { 
      type: Number, 
      default: 24 
    }, // <--- BARU (SLA default 24 jam)
    maintenanceStatus: {
      type: String,
      enum: ["Submitted", "In Progress", "Completed", "Assigned"],
      default: "Submitted",
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    timeToComplete: { type: Number, default: null }, // dalam minit
    finalStatus: { 
      type: String, 
      enum: ["Pending", "Approved", "Rejected"], 
      default: "Pending" 
    },
    serialNumber: { type: String, unique: true, required: true },
  },
  {
    timestamps: true, // ✅ betul, diletak sebagai option kedua
  }
);


export default mongoose.model("Request", requestSchema);
