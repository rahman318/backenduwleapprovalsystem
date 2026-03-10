// backend/routes/requestRoutes.js
import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import { sendEmail } from "../utils/emailService.js";
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
  assignTechnician,
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
      let payload;
if (req.body.data) {
  payload = JSON.parse(req.body.data); // parsed JSON object
} else {
  payload = { ...req.body }; // clone object supaya kita boleh attach fileUrl
}

if (req.fileUrl) {
  payload.fileUrl = req.fileUrl; // ✅ attach public URL
}

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

// ================== PATCH REMARK ==================
router.patch("/:id/remark", authMiddleware, async (req, res) => {
  try {
    const { remark } = req.body;
    const request = await Request.findById(req.params.id);

    if (!request) return res.status(404).json({ message: "Request tak jumpa" });

    // Hanya assigned technician boleh update remark
    if (!request.assignedTechnician || request.assignedTechnician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    request.technicianRemark = remark;
    await request.save();

    res.status(200).json({ message: "Remark berjaya disimpan", request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================== PATCH TECHNICIAN UPDATE (Remark + Proof Image) ==================
router.patch(
  "/:id/technician-update",
  authMiddleware,
  upload.single("proofImage"), // multer untuk handle image
  async (req, res) => {
    try {
      const { id } = req.params;
      const { technicianRemark } = req.body;
      const file = req.file;

      const request = await Request.findById(id);
      if (!request) return res.status(404).json({ message: "Request tidak ditemui" });

      // ✅ Pastikan hanya assigned technician boleh update
      if (!request.assignedTechnician || request.assignedTechnician.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Akses ditolak: bukan technician assigned" });
      }

      // ================= Save proof image to Supabase =================
      if (file) {
        const fileName = Date.now() + "-" + file.originalname;
        const { data, error } = await supabase.storage
          .from("eapproval_uploads")
          .upload(fileName, file.buffer, { upsert: true });

        if (error) throw error;

        const { data: publicData } = supabase.storage
          .from("eapproval_uploads")
          .getPublicUrl(fileName);

        request.proofImageUrl = publicData.publicUrl;
      }

      // ================= Update remark =================
      if (technicianRemark) request.technicianRemark = technicianRemark;

      await request.save();
      res.json({ message: "Technician update berjaya", request });
    } catch (err) {
      console.error("❌ Technician update error:", err);
      res.status(500).json({ message: "Gagal kemaskini technician update", error: err.message });
    }
  }
);

// ================== ASSIGN TECHNICIAN ==================
router.put("/:id/assign-technician", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { technicianId } = req.body;

    if (!technicianId) {
      return res.status(400).json({ message: "TechnicianId diperlukan" });
    }

    if (user.role.toLowerCase() !== "approver") {
      return res.status(403).json({ message: "Hanya Approver boleh assign." });
    }

    const request = await Request.findById(id).exec();
    if (!request) return res.status(404).json({ message: "Request tidak dijumpai" });

    const technician = await User.findById(technicianId).exec();
    if (!technician) return res.status(404).json({ message: "Technician tidak dijumpai" });

    if (technician.role.toLowerCase() !== "technician") {
      return res.status(400).json({ message: "User bukan technician" });
    }

    request.assignedTechnician = technician._id;
    request.slaHours = request.priority === "Urgent" ? 4 : 24;
    request.finalStatus = "Approved";
    request.maintenanceStatus = "Submitted";
    request.assignedAt = new Date(); // tambah assignedAt supaya email ada tarikh

    await request.save();

    // ================== EMAIL NOTIFICATION ==================
    console.log("📧 Preparing to send email notification to technician...");

    const issue = request.problemDescription || request.details?.issue || "Not Provided";
    const location = request.details?.location || "Not Provided";
    const priority = request.priority || "Normal";
    const sla = request.slaHours || 24;
    const assignedAt = request.assignedAt ? new Date(request.assignedAt).toLocaleString() : "Not Assigned";

    if (technician.email && technician.email.includes("@")) {
      try {
        const dashboardUrl = process.env.DASHBOARD_URL || "https://uwleapprovalsystem.onrender.com";

        const html = `
<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
  <h2 style="color: #1a73e8;">New Maintenance Task Assigned</h2>
  <p>Hello <strong>${technician.name}</strong>,</p>
  <p>You have been assigned a new maintenance request. Please review the details below and start the task as soon as possible.</p>
  <hr/>
  <table style="width:100%; border-collapse: collapse; margin: 15px 0;">
    <tr>
      <td style="padding:6px 8px; font-weight:bold; background:#f0f0f0;">Issue</td>
      <td style="padding:6px 8px;">${issue}</td>
    </tr>
    <tr>
      <td style="padding:6px 8px; font-weight:bold; background:#f0f0f0;">Location</td>
      <td style="padding:6px 8px;">${location}</td>
    </tr>
    <tr>
      <td style="padding:6px 8px; font-weight:bold; background:#f0f0f0;">Priority</td>
      <td style="padding:6px 8px;">${priority}</td>
    </tr>
    <tr>
      <td style="padding:6px 8px; font-weight:bold; background:#f0f0f0;">SLA</td>
      <td style="padding:6px 8px;">${sla} hours</td>
    </tr>
    <tr>
      <td style="padding:6px 8px; font-weight:bold; background:#f0f0f0;">Assigned At</td>
      <td style="padding:6px 8px;">${assignedAt}</td>
    </tr>
  </table>
  <p>
    <a href="${dashboardUrl}" style="background:#1a73e8;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">Log Masuk Dashboard</a>
  </p>
  <p style="font-size:12px;color:gray;">
    This is an automated message from E-Approval System.
  </p>
</div>
        `;

        await sendEmail({
          to: technician.email,
          subject: `New Maintenance Task Assigned - ${issue}`,
          html,
        });

        console.log(`✅ SUCCESS: Email sent to ${technician.email}`);
      } catch (emailErr) {
        console.error("❌ FAILED: Email sending error", emailErr.message);
      }
    } else {
      console.warn(`⚠️ Technician ${technician.name} tidak ada email valid`);
    }

    res.status(200).json({
      message: "Technician assigned successfully.",
      request,
    });
  } catch (err) {
    console.error("❌ Error assign technician:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================== EXPORT ROUTER ==================
export default router;
