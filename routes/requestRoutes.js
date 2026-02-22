// backend/routes/requestRoutes.js
import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import authMiddleware from "../Middleware/authMiddleware.js";
import supabase from "../Middleware/supabase.js"; 
import Request from "../models/Requests.js";
import User from "../models/user.js";

import {
  createRequest,
  getRequests,
  approveLevel,
  rejectLevel,
  deleteRequestById,
  technicianUpdateStatus,
} from "../controllers/requestController.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js";

const router = express.Router();

// ================== MULTER ==================
const storage = multer.memoryStorage(); // tak perlu simpan temp di disk
const upload = multer({ storage });

// ================== Middleware: Upload ke Supabase ==================
const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return next();

  try {
    // req.file.buffer dah ada content file
    const fileName = Date.now() + "-" + req.file.originalname;

    const { data, error } = await supabase.storage
      .from("eapproval_uploads")
      .upload(fileName, req.file.buffer, { upsert: true });

    if (error) throw error;

    // public URL
    const { data: publicData } = supabase.storage
      .from("eapproval_uploads")
      .getPublicUrl(fileName);

    req.fileUrl = publicData.publicUrl; // ✅ public URL betul
    console.log("✅ File uploaded ke Supabase:", req.fileUrl);

    next();
  } catch (err) {
    console.error("❌ Supabase upload failed:", err.message);
    res.status(500).json({ message: "Upload failed" });
  }
};

// ================== CREATE REQUEST ==================
router.post(
  "/",
  authMiddleware,
  upload.single("files"),
  uploadToSupabase,
  (req, res, next) => {
    try {
      let payload = req.body;
      if (req.body.data) payload = JSON.parse(req.body.data);

      if (req.fileUrl) payload.fileUrl = req.fileUrl;

      req.parsedData = payload;
      next();
    } catch (err) {
      return res.status(400).json({ message: "Data JSON tak valid" });
    }
  },
  createRequest
);

// ================== DELETE REQUEST ==================
router.delete("/:id", authMiddleware, deleteRequestById);

// ================== GET ALL REQUESTS ==================
router.get("/", authMiddleware, getRequests);

// ================== APPROVE / REJECT ==================
router.put("/approve-level/:id", authMiddleware, approveLevel);
router.put("/reject-level/:id", authMiddleware, rejectLevel);

// ================== GENERATE PDF ==================
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const pdfBytes = await generatePDFWithLogo(id);
    const pdfBuffer = Buffer.from(pdfBytes);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Permohonan_${id}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ PDF generate error:", err);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
});

// ================== GET REQUESTS FOR TECHNICIAN ==================
router.get("/technician", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "technician") return res.status(403).json({ message: "Hanya Technician." });

    const requests = await Request.find({
      assignedTechnician: user._id,
      maintenanceStatus: { $in: ["Submitted", "In Progress"] },
    }).sort({ createdAt: -1 });

    const formatted = requests.map((r) => ({
      _id: r._id,
      serialNumber: r.serialNumber || "-",
      staffName: r.staffName || "-",
      staffDepartment: r.staffDepartment || "-",
      requestType: r.requestType || "-",
      finalStatus: r.finalStatus || "Pending",
      maintenanceStatus: r.maintenanceStatus || "Submitted",
      attachments: r.attachments || [],
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("❌ Error getTechnicianRequests:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================== TECHNICIAN UPDATE STATUS ==================
router.put("/:id/maintenance", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role.toLowerCase() !== "technician") {
      return res.status(403).json({ message: "Hanya Technician boleh update status" });
    }

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request tak jumpa" });

    // ✅ Pastikan hanya technician assigned boleh update
    if (!request.assignedTechnician || request.assignedTechnician.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Akses ditolak: bukan technician assigned" });
    }

    // ✅ Update status ikut backend logic
    if (request.maintenanceStatus === "Submitted") {
      request.maintenanceStatus = "In Progress";
      request.startedAt = new Date();
    } else if (request.maintenanceStatus === "In Progress") {
      request.maintenanceStatus = "Completed";
      request.completedAt = new Date();

      // ===== Kira Time to Complete =====
      if (request.startedAt) {
        const durationMs = request.completedAt - request.startedAt;
        request.timeToComplete = Math.round(durationMs / 60000); // simpan dalam minit
      }
    } else {
      return res.status(400).json({ message: "Status Completed tak boleh update lagi" });
    }

    await request.save();
    res.status(200).json({ message: "Status dikemaskini", request });
  } catch (err) {
    console.error("❌ Technician update error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================== ASSIGN TECHNICIAN ==================
router.put("/:id/assign-technician", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { technicianId } = req.body;

    if (!technicianId)
      return res.status(400).json({ message: "TechnicianId diperlukan" });

    // ✅ Hanya Approver boleh assign
    if (user.role.toLowerCase() !== "approver")
      return res.status(403).json({ message: "Hanya Approver boleh assign." });

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request tidak dijumpai" });

    const technician = await User.findById(technicianId);
    if (!technician) return res.status(404).json({ message: "Technician tidak dijumpai" });
    if (technician.role.toLowerCase() !== "technician")
      return res.status(400).json({ message: "User bukan technician" });

    // ✅ Update request
    request.assignedTechnician = technicianId;
    // SLA logic
if (request.priority === "Urgent") {
  request.slaHours = 4;
} else {
  request.slaHours = 24;
}
    request.maintenanceStatus = "Submitted"; // reset status bila assign baru
    await request.save();

    console.log(`⚠️ Email skipped: assign technician to ${technician.email}`);

    res.status(200).json({
      message: "Technician assigned (email skipped).",
      request, // return object supaya frontend update UI terus
    });
  } catch (err) {
    console.error("❌ Error assign technician:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;