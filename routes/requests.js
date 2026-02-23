// routes/request.js
import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/auth.js";
import Request from "../models/request.js";
import User from "../models/user.js";
import sendEmail from "../utils/emailService.js";
import { uploadFileToSupabase } from "../utils/supabaseUpload.js";
import { generatePDFWithLogo } from "../utils/generateGenericPDF.js";

const router = express.Router();

// ================== MULTER MEMORY STORAGE ==================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================== CREATE REQUEST ==================
router.post("/", verifyToken, upload.array("files"), async (req, res) => {
  try {
    const { userId, staffName, staffDepartment, requestType, details, approvals, items, signatureStaff } = req.body;

    // Parse JSON fields
    const parsedDetails = details ? JSON.parse(details) : {};
    const parsedItems = items ? JSON.parse(items) : [];
    let parsedApprovals = approvals ? JSON.parse(approvals) : [];

    // Filter only approvals with approverId
    const approvalsData = Array.isArray(parsedApprovals)
      ? parsedApprovals.filter(a => a.approverId).map((a, idx) => ({
          level: a.level || idx + 1,
          approverId: a.approverId,
          approverName: a.approverName || "-",
          approverDepartment: a.approverDepartment || "-",
          status: "Pending",
          remark: "",
          signature: null,
          actionDate: null,
        }))
      : [];

    // 🔹 Upload multiple files to Supabase
    let attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = await uploadFileToSupabase(file); // return public URL
        attachments.push({
          originalName: file.originalname,
          fileUrl,
          mimetype: file.mimetype,
          size: file.size,
        });
      }
    }

    // Fallback department
    let department = staffDepartment;
    if (!department && userId) {
      const staff = await User.findById(userId);
      department = staff?.department || "-";
    }

    const newRequest = new Request({
      userId,
      staffName,
      staffDepartment: department || "-",
      requestType,
      details: parsedDetails,
      items: parsedItems,
      approvals: approvalsData,
      signatureStaff: signatureStaff || null,
      attachments,
      finalStatus: "Pending",
      maintenanceStatus: requestType === "Maintenance" ? "Submitted" : undefined,
    });

    const savedRequest = await newRequest.save();

    // 🔹 Send email notification to approvers
    for (const approval of approvalsData) {
      if (!approval.approverId) continue;
      const approverUser = await User.findById(approval.approverId);
      if (!approverUser?.email) continue;

      const subject = `Permohonan Baru Dari ${staffName}`;
      const html = `
        <p>Hi ${approverUser.username || approval.approverName},</p>
        <p>Anda mempunyai permohonan baru untuk semakan.</p>
        <p><b>Jenis Permohonan:</b> ${requestType}</p>
        <p><b>Butiran:</b> ${details || "-"}</p>
        <p>Sila log masuk dashboard untuk semakan.</p>
      `;
      await sendEmail(approverUser.email, subject, html);
    }

    res.status(201).json({ success: true, request: savedRequest });
  } catch (err) {
    console.error("❌ CREATE REQUEST ERROR:", err);
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
});


// ================== GET ALL REQUESTS ==================
router.get("/", verifyToken, async (req, res) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching requests" });
  }
});

// ================== GET REQUESTS FOR TECHNICIAN ==================
router.get("/technician", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "technician") {
      return res.status(403).json({ message: "Akses ditolak. Hanya Technician." });
    }

    const requests = await Request.find()
      .populate("assignedTechnician", "username") // <-- populate username je
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch requests for analytics" });
  }
};

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

// ================== GET REQUESTS FOR APPROVER ==================
router.get("/approver/:approverId", verifyToken, async (req, res) => {
  try {
    const { approverId } = req.params;
    const { startDate, endDate } = req.query;

    const filter = { "approvals.approverId": approverId };
    if (startDate && endDate) filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

    const requests = await Request.find(filter).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching requests" });
  }
});

// ================== APPROVE LEVEL ==================
router.put("/approve/:requestId", verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { approverId, remark, signature } = req.body;

    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const levelObj = request.approvals.find(a => a.approverId.toString() === approverId);
    if (!levelObj) return res.status(404).json({ message: "Approval level not found" });
    if (levelObj.status !== "Pending") return res.status(400).json({ message: "Already processed" });

    levelObj.status = "Approved";
    levelObj.remark = remark || "";
    levelObj.signature = signature || null;
    levelObj.actionDate = new Date();

    if (request.approvals.every(a => a.status === "Approved")) request.finalStatus = "Approved";

    await request.save();
    res.json({ message: "Request approved!", request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error approve request" });
  }
});

// ================== REJECT LEVEL ==================
router.put("/reject/:requestId", verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { approverId, remark, signature } = req.body;

    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const levelObj = request.approvals.find(a => a.approverId.toString() === approverId);
    if (!levelObj) return res.status(404).json({ message: "Approval level not found" });
    if (levelObj.status !== "Pending") return res.status(400).json({ message: "Already processed" });

    levelObj.status = "Rejected";
    levelObj.remark = remark || "";
    levelObj.signature = signature || null;
    levelObj.actionDate = new Date();

    request.finalStatus = "Rejected";

    await request.save();
    res.json({ message: "Request rejected!", request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error reject request" });
  }
});

// ================== DOWNLOAD PDF ==================
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await generatePDFWithLogo(id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Permohonan_${id}.pdf`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error("❌ PDF generate error:", err);
    res.status(500).send("PDF gagal dijana");
  }
});


export default router;
