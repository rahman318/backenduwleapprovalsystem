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
  getMyRequests,
  getRequestsForTechnician,
  approveLevel,
  rejectLevel,
  deleteRequestById,
  technicianUpdateStatus,
  assignTechnician,
} from "../controllers/requestController.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js";
import { sendPushNotification } from "../utils/sendPush.js"; // 🔥 Inject push
import PushSubscription from "../models/Subscription.js";

const router = express.Router();

// ================== MULTER ==================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================== Middleware: Upload ke Supabase ==================
const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const fileName = Date.now() + "-" + req.file.originalname;
    const { data, error } = await supabase.storage
      .from("eapproval_uploads")
      .upload(fileName, req.file.buffer, { upsert: true });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from("eapproval_uploads")
      .getPublicUrl(fileName);

    req.fileUrl = publicData.publicUrl;
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
        payload = JSON.parse(req.body.data);
      } else {
        payload = { ...req.body };
      }

      if (req.fileUrl) payload.fileUrl = req.fileUrl;

      req.parsedData = payload;
      next();
    } catch (err) {
      return res.status(400).json({ message: "Data JSON tak valid" });
    }
  },
  createRequest,
  async (req, res) => {
    try {
      // 🔥 Push notification ke semua PWA subscriber
      const requestData = req.parsedData;
      await sendPushNotification(
        "📢 New Request Created",
        `Request: ${requestData.title || "No Title"} dari ${req.user.username || "Staff"}`,
        `/my-requests`
      );
    } catch (err) {
      console.error("❌ Push notification error:", err.message);
    }
  }
);

// ================== DELETE REQUEST ==================
router.delete("/:id", authMiddleware, deleteRequestById);

// ================== GET ALL REQUESTS ==================
router.get("/", authMiddleware, getRequests);

// 🔥 route baru untuk staff lihat history
router.get("/my-requests", authMiddleware, getMyRequests);

// ================== APPROVE / REJECT ==================
router.put("/approve-level/:id", authMiddleware, approveLevel);
router.put("/reject-level/:id", authMiddleware, rejectLevel);

// ================== GET SINGLE REQUEST BY ID ==================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    res.json({ request });
  } catch (err) {
    console.error("❌ GET request by ID error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

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

    // ================== DEBUG USER ==================
    console.log("👤 TECH USER LOGIN:", {
      id: user._id,
      role: user.role,
    });

    if (user.role !== "technician") {
      console.log("⛔ ACCESS DENIED - NOT TECHNICIAN");
      return res.status(403).json({ message: "Hanya Technician." });
    }

    // ================== MAIN QUERY ==================
    const requests = await Request.find({
      assignedTechnician: { $in: [user._id] }, // 🔥 SAFE FOR SINGLE + MULTI
      maintenanceStatus: { $in: ["Submitted", "In Progress"] },
    })
      .populate("userId", "username department email")
      .populate("assignedTechnician", "username name email") // 🔥 IMPORTANT
      .sort({ createdAt: -1 });

    // ================== DEBUG RESULTS ==================
    console.log("📦 TOTAL REQUESTS FOUND:", requests.length);

    console.log(
      "🧪 SAMPLE REQUEST (FIRST ITEM):",
      requests[0]
        ? {
            id: requests[0]._id,
            type: requests[0].requestType,
            status: requests[0].maintenanceStatus,
            tech: requests[0].assignedTechnician,
          }
        : "NO REQUEST FOUND"
    );

    // ================== FORMAT RESPONSE ==================
    const formatted = requests.map((r, index) => {
      console.log(`🔍 Mapping Request #${index + 1}`, r._id);

      return {
        _id: r._id,
        serialNumber: r.serialNumber || "-",
        staffName: r.staffName || "-",
        staffDepartment: r.staffDepartment || "-",
        requestType: r.requestType || "-",
        finalStatus: r.finalStatus || "Pending",
        maintenanceStatus: r.maintenanceStatus || "Submitted",
        attachments: r.attachments || [],

        // 🔥 DEBUG TECH VALUE
        assignedTechnician: r.assignedTechnician,

        startedAt: r.startedAt,
        completedAt: r.completedAt,
      };
    });

    // ================== FINAL DEBUG ==================
    console.log("✅ FORMATTED RESPONSE READY:", formatted.length);

    res.status(200).json(formatted);
  } catch (err) {
    console.error("❌ Error getTechnicianRequests:", {
      message: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

// ================== TECHNICIAN UPDATE STATUS ==================
router.put("/:id/maintenance", authMiddleware, technicianUpdateStatus);

// ================== PATCH REMARK ==================
router.patch("/:id/remark", authMiddleware, async (req, res) => {
  try {
    const { remark } = req.body;
    const request = await Request.findById(req.params.id);

    if (!request) return res.status(404).json({ message: "Request tak jumpa" });

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
  upload.single("proofImage"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { technicianRemark } = req.body;
      const file = req.file;

      const request = await Request.findById(id);
      if (!request) return res.status(404).json({ message: "Request tidak ditemui" });

      if (!request.assignedTechnician || request.assignedTechnician.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Akses ditolak: bukan technician assigned" });
      }

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

  console.log("🔥 ROUTE HIT CONFIRMED");
  console.log("👤 USER:", req.user);
  console.log("📦 BODY:", req.body);

  try {
    const user = req.user;
    const { id } = req.params;
    const { technicianIds } = req.body; // ✅ array now

    // ================== VALIDATION ==================
    if (!Array.isArray(technicianIds) || technicianIds.length === 0) {
      return res.status(400).json({
        message: "Sila pilih sekurang-kurangnya seorang technician",
      });
    }

    if (user.role.toLowerCase() !== "approver") {
      return res.status(403).json({
        message: "Hanya Approver boleh assign.",
      });
    }

    // ================== FIND REQUEST ==================
    const request = await Request.findById(id);
    if (!request) {
      return res.status(404).json({
        message: "Request tidak dijumpai",
      });
    }

    console.log("📄 REQUEST FOUND:", request._id);

    // ================== VALIDATE TECHNICIANS ==================
    const technicians = await User.find({
      _id: { $in: technicianIds },
      role: "technician",
    });

    console.log("👨‍🔧 VALID TECHNICIANS:", technicians);

    if (!technicians.length) {
      return res.status(400).json({
        message: "Tiada technician sah dijumpai",
      });
    }

    // ================== ASSIGN MULTIPLE ==================
    request.assignedTechnician = technicians.map((t) => t._id);

    request.slaHours = request.priority === "Urgent" ? 4 : 24;
    request.finalStatus = "Approved";
    request.maintenanceStatus = "Submitted";
    request.assignedAt = new Date();

    await request.save();

    // ================== EMAIL NOTIFICATION FIXED ==================
console.log("📧 Preparing to send email notification to technicians...");

// Parse details jika string
let detailsObj = {};
if (request.details) {
  try {
    detailsObj =
      typeof request.details === "string"
        ? JSON.parse(request.details)
        : request.details;
  } catch (parseErr) {
    console.warn("⚠️ Failed to parse request.details:", parseErr.message);
    detailsObj = {};
  }
}

// Ambil data
const issue =
  request.problemDescription ||
  detailsObj.issue ||
  request.requestType ||
  "Not Provided";

const location =
  detailsObj.location ||
  request.requestLocation ||
  request.location ||
  "Not Provided";

const priority =
  detailsObj.priority ||
  request.priority ||
  "Normal";

const sla = request.slaHours || 24;

const assignedAt = request.assignedAt
  ? new Date(request.assignedAt).toLocaleString()
  : "Not Assigned";

// ================= EMAIL LOOP =================
if (Array.isArray(technicianIds) && technicianIds.length > 0) {
  await Promise.all(
    technicianIds.map(async (techId) => {
      const technician = await User.findById(techId);

      if (!technician) return;

      if (technician.email && technician.email.includes("@")) {
        try {
          const dashboardUrl =
            process.env.DASHBOARD_URL ||
            "https://uwleapprovalsystem.onrender.com";

          // ✅ TEMPLATE KAU KEKAL (FIXED)
          const html = `
<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
  <h2 style="color: #1a73e8;">New Maintenance Task Assigned</h2>

  <p>Hello <strong>${technician.name || "Technician"}</strong>,</p>
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
    <a href="${dashboardUrl}" style="background:#1a73e8;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">
      Log Masuk Dashboard
    </a>
  </p>

  <p style="font-size:12px;color:gray;">
    This is an automated message from E-Approval System.
  </p>
</div>
          `;

          await sendEmail({
            to: technician.email,
            subject: "Task Baru Assigned 🔧",
            html,
          });

          console.log(`✅ SUCCESS: Email sent to ${technician.email}`);
        } catch (emailErr) {
          console.error(
            `❌ FAILED: Email sending error for ${technician.email}`,
            emailErr.message
          );
        }
      } else {
        console.warn(
          `⚠️ Technician ${technician?.name || techId} tidak ada email valid`
        );
      }
    })
  );
}

// ================= PUSH NOTIFICATION TO TECHNICIAN =================
try {
  console.log("📡 Checking technician push subscriptions...");

  const subscriptions = await PushSubscription.find({
    userId: technician._id
  }).lean();

  console.log("📡 Total subscriptions:", subscriptions.length);

  if (!subscriptions.length) {
    console.warn("⚠️ No push subscription found");
  }

  const validSubs = subscriptions.filter(sub =>
    sub?.subscription?.endpoint &&
    sub?.subscription?.keys?.p256dh &&
    sub?.subscription?.keys?.auth
  );

  console.log("✅ Valid subscriptions:", validSubs.length);

  // 🔥 CLEAN PAYLOAD (IMPORTANT)
  const payload = JSON.stringify({
    title: "🔧 Task Baru Assigned",
    body: `Satu job maintenance: ${issue}`,
    url: `/technician/tasks/${request._id}`,
    role: "technician",
    requestId: request._id
  });

  for (const sub of validSubs) {
    try {
      console.log("📤 Sending push:", sub._id);

      await sendPushNotification(
        sub.subscription,
        payload
      );

      console.log("✅ PUSH SENT:", sub._id);

    } catch (err) {
      console.error("❌ PUSH FAILED:", err.message);

      await PushSubscription.findByIdAndDelete(sub._id);
    }
  }

} catch (pushErr) {
  console.error("❌ Push block error (assignTechnician):", pushErr.message);
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

// ================== RECALL REQUEST ==================
router.put("/:id/recall", authMiddleware, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.finalStatus?.trim().toLowerCase() !== "pending") {
      return res.status(400).json({ message: "Only pending request can be recalled" });
    }

    request.finalStatus = "recalled";
    request.isRecalled = true;

    await request.save();
    res.json({ message: "Request recalled successfully", request });
  } catch (err) {
    console.error("❌ Recall request error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================== UPDATE / EDIT REQUEST ==================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const allowedFields = ["title", "description", "finalStatus"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) request[field] = req.body[field];
    });

    request.status = "Pending";
    request.isRecalled = false;

    await request.save();
    res.json({ message: "Request updated & resubmitted", request });
  } catch (err) {
    console.error("❌ Edit request error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================== EXPORT ROUTER ==================
export default router;
