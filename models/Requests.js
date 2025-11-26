import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    staffName: {
      type: String,
      required: true,
    },

staffDepartment: { type: String, default: "-" },

    requestType: {
      type: String,
      enum: ["Cuti", "Pembelian", "IT Support"],
      required: true,
    },

    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // --- Untuk Cuti Sahaja ---
    leaveStart: { type: Date, default: null },
    leaveEnd: { type: Date, default: null },

    // --- Untuk Pembelian Sahaja (Senarai Barang) ---
    items: [
      {
        itemName: { type: String },
        quantity: { type: Number },
        remarks: { type: String, default: "" },
      }
    ],

    details: {
      type: String,
      default: "",
    },

    file: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    signatureStaff: { type: String, default: null },
    signatureApprover: { type: String, default: null },

    // ✅ Nama Approver (untuk PDF)
    approverName: {
      type: String,
      default: "-",
    },

     approverDepartment: {
      type: String,
      default: "-",
  },
  },
  { timestamps: true }
);

export default mongoose.model("Request", requestSchema);