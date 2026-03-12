// controllers/requestController.js
import Request from "../models/Requests.js";
import User from "../models/user.js";
import { sendEmail } from "../utils/emailService.js";
import { uploadFileToSupabase } from "../utils/supabaseUpload.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js";
import multer from "multer";

// ================== MULTER ==================
export const upload = multer({ storage: multer.memoryStorage() });

/* =========================================================
   HELPER : GENERATE PDF SAFE
========================================================= */
async function safeGeneratePDF(requestId) {
  try {
    const pdf = await generatePDFWithLogo(requestId);
    if (!Buffer.isBuffer(pdf)) return null;
    return pdf;
  } catch (err) {
    console.error("❌ PDF generation error:", err.message);
    return null;
  }
}

/* =========================================================
   DELETE REQUEST
========================================================= */
export const deleteRequestById = async (req, res) => {
  try {
    const request = await Request.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    res.json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   CREATE REQUEST
========================================================= */
export const createRequest = async (req, res) => {
  try {

    /* ---------- FILE UPLOAD ---------- */
    let attachmentsData = [];
    if (req.file) {
      const publicUrl = await uploadFileToSupabase(req.file);
      attachmentsData.push({
        originalName: req.file.originalname,
        fileName: req.file.originalname,
        url: publicUrl,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }

    /* ---------- BODY DATA ---------- */
    const {
      userId,
      staffName,
      staffDepartment,
      requestType,
      details,
      problemDescription,
      signatureStaff,
      leaveStart,
      leaveEnd,
      items,
      approvals,
      assignedTechnician,
    } = req.body;

    /* ---------- SERIAL NUMBER ---------- */
    const lastRequest = await Request.findOne().sort({ createdAt: -1 });
    let lastNumber = 0;

    if (lastRequest?.serialNumber) {
      const parts = lastRequest.serialNumber.split("-");
      lastNumber = parseInt(parts[2]) || 0;
    }

    const year = new Date().getFullYear();
    const serialNumber = `REQ-${year}-${String(lastNumber + 1).padStart(4, "0")}`;

    /* ---------- APPROVALS PARSE ---------- */
    let approvalsData = [];

    if (approvals) {
      const parsed = typeof approvals === "string"
        ? JSON.parse(approvals || "[]")
        : approvals;

      approvalsData = parsed.map((a, index) => ({
        level: a.level || index + 1,
        approverId: a.approverId || null,
        approverName: a.approverName || "-",
        approverDepartment: a.approverDepartment || "-",
        status: "Pending",
        remark: "",
        signature: null,
        actionDate: null,
      }));
    }

    /* ---------- ITEMS PARSE ---------- */
    let itemsData = [];

    if (items) {
      const parsed = typeof items === "string"
        ? JSON.parse(items || "[]")
        : items;

      itemsData = parsed.map(item => ({
        itemName: item.itemName || item.description || "-",
        quantity: Number(item.quantity || item.qty) || 0,
        estimatedCost: Number(item.estimatedCost) || 0,
        supplier: item.supplier || "",
        reason: item.reason || item.remarks || "-",
        startDate: item.startDate ? new Date(item.startDate) : null,
        endDate: item.endDate ? new Date(item.endDate) : null,
      }));
    }

    /* ---------- CREATE REQUEST ---------- */
    const newRequest = new Request({
      userId,
      staffName,
      staffDepartment: staffDepartment || "-",
      requestType,
      details: details || "",
      problemDescription: problemDescription || "",
      signatureStaff: signatureStaff || "",
      attachments: attachmentsData,
      leaveStart: requestType === "Cuti" ? leaveStart : undefined,
      leaveEnd: requestType === "Cuti" ? leaveEnd : undefined,
      items: itemsData,
      approvals: approvalsData,
      serialNumber,
      finalStatus: "Pending",
      assignedTechnician: assignedTechnician || null,
    });

    await newRequest.save();

    const populatedRequest = await Request.findById(newRequest._id)
      .populate("userId", "username department email")
      .populate("approvals.approverId", "username department email");

    /* ---------- GENERATE PDF ---------- */
    const pdfBuffer = await safeGeneratePDF(newRequest._id);

    /* ---------- EMAIL APPROVERS ---------- */
    for (const approval of populatedRequest.approvals) {

      if (!approval.approverId?.email) continue;

      const html = `
      <div style="font-family:Arial">
        <h2>Permohonan Baru Untuk Semakan</h2>
        <p>Hi <b>${approval.approverId.username}</b>,</p>
        <p>Permohonan baru telah dihantar oleh <b>${staffName}</b>.</p>
        <p><b>Jenis:</b> ${requestType}</p>
      </div>`;

      await sendEmail({
        to: approval.approverId.email,
        subject: `Permohonan Baru Dari ${staffName}`,
        html,
        attachments: pdfBuffer
          ? [{ filename: `Permohonan_${newRequest._id}.pdf`, content: pdfBuffer }]
          : [],
      });
    }

    res.status(201).json(populatedRequest);

  } catch (err) {
    console.error("❌ createRequest error:", err);
    res.status(500).json({ message: "Gagal simpan request", error: err.message });
  }
};

/* =========================================================
   GET ALL REQUESTS
========================================================= */
export const getRequests = async (req, res) => {
  try {

    const requests = await Request.find()
      .populate("userId", "username department email")
      .populate("approvals.approverId", "username department email")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   APPROVE LEVEL
========================================================= */
export const approveLevel = async (req, res) => {

  try {

    const request = await Request.findById(req.params.id).populate("userId");

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    const level = request.approvals.find(
      a => a.approverId?.toString() === req.user._id.toString()
    );

    if (!level)
      return res.status(403).json({ message: "Not authorized to approve" });

    level.status = "Approved";
    level.actionDate = new Date();

    if (req.body.signatureApprover)
      level.signature = req.body.signatureApprover;

    const allApproved = request.approvals.every(a => a.status === "Approved");

    if (allApproved) {
      request.finalStatus = "Approved";

      const pdfBuffer = await safeGeneratePDF(request._id);

      if (request.userId?.email) {
        await sendEmail({
          to: request.userId.email,
          subject: "Permohonan Diluluskan",
          html: `<p>Permohonan anda telah diluluskan.</p>`,
          attachments: pdfBuffer
            ? [{ filename: `Permohonan_${request._id}.pdf`, content: pdfBuffer }]
            : [],
        });
      }
    }

    await request.save();

    res.json({ message: "Approved successfully", request });

  } catch (err) {

    console.error("❌ approveLevel error:", err);

    res.status(500).json({
      message: "Approve failed",
      error: err.message,
    });

  }
};

/* =========================================================
   REJECT LEVEL
========================================================= */
export const rejectLevel = async (req, res) => {

  try {

    const request = await Request.findById(req.params.id);

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    const level = request.approvals.find(
      a => a.approverId?.toString() === req.user._id.toString()
    );

    if (!level)
      return res.status(403).json({ message: "Not authorized" });

    level.status = "Rejected";
    level.actionDate = new Date();

    request.finalStatus = "Rejected";

    await request.save();

    res.json({ message: "Request rejected", request });

  } catch (err) {

    res.status(500).json({
      message: "Reject failed",
      error: err.message,
    });

  }
};

/* =========================================================
   DOWNLOAD PDF
========================================================= */
export const downloadGenericPDF = async (req, res) => {

  try {

    const { id } = req.params;

    const pdfBytes = await generatePDFWithLogo(id);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Request_${id}.pdf`,
    });

    res.send(pdfBytes);

  } catch (err) {

    res.status(500).json({
      message: "PDF download error",
      error: err.message,
    });

  }
};
