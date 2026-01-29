// routes/request.js
import express from "express";
import Request from "../models/request.js";
import { verifyToken } from "../middleware/auth.js"; // middleware JWT
import multer from "multer";
import fs from "fs";
import path from "path";
import { generatePDFWithLogo } from "../utils/generateGenericPDF.js";
import { uploadFileToSupabase } from "../utils/supabaseUpload.js"; // 🔥 new helper

const router = express.Router();

// ================== MULTER SETUP ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// ================== CREATE REQUEST ==================
router.post(
  "/",
  verifyToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const { userId, staffName, staffDepartment, requestType, details, approvals, items, signatureStaff } = req.body;

      // 🔹 Parse JSON fields
      const parsedDetails = details ? JSON.parse(details) : {};
      const parsedItems = items ? JSON.parse(items) : [];
      const parsedApprovals = approvals ? JSON.parse(approvals) : [];

      // 🔹 Handle approvals: hanya yang ada approverId
      const approvalsData = Array.isArray(parsedApprovals)
        ? parsedApprovals
            .filter(a => a.approverId)
            .map((a, idx) => ({
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

      // 🔹 Upload file to Supabase
      let fileUrl = null;
      let attachments = [];

      if (req.file) {
        fileUrl = await uploadFileToSupabase(req.file);

        attachments.push({
          originalName: req.file.originalname,
          fileUrl,
          mimetype: req.file.mimetype,
          size: req.file.size,
        });
      }

      // 🔹 Create new request
      const newRequest = new Request({
        userId,
        staffName,
        staffDepartment: staffDepartment || "-",
        requestType,
        details: parsedDetails,
        items: parsedItems,
        approvals: approvalsData,
        signatureStaff: signatureStaff || null,
        file: fileUrl,
        attachments,
        finalStatus: "Pending",
      });

      const savedRequest = await newRequest.save();
      res.status(201).json({ success: true, data: savedRequest });
    } catch (err) {
      console.error("CREATE REQUEST ERROR:", err);
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  }
);

// ================== GET ALL REQUESTS ==================
router.get("/", verifyToken, async (req, res) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
    res.json(requests.map(r => ({
      ...r._doc,
      fileUrl: r.file || null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching requests" });
  }
});

// ================== GET REQUESTS FOR APPROVER ==================
router.get("/approver/:approverId", verifyToken, async (req, res) => {
  try {
    const { approverId } = req.params;
    const { startDate, endDate } = req.query;

    let filter = { "approvals.approverId": approverId };
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const requests = await Request.find(filter).sort({ createdAt: -1 });
    res.json(requests.map(r => ({
      ...r._doc,
      fileUrl: r.file || null,
    })));
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
