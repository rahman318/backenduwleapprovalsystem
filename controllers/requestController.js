// controllers/requestController.js
import Request from "../models/Requests.js";
import User from "../models/user.js";
import { sendEmail } from "../utils/emailService.js";
import { uploadFileToSupabase } from "../utils/supabaseUpload.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js"; // ✅ Guna PDF utility ini
import multer from "multer";

// ================== MULTER SETUP ==================
export const upload = multer({ storage: multer.memoryStorage() });

// ================== DELETE REQUEST ==================
export const deleteRequestById = async (req, res) => {
  try {
    const request = await Request.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================== CREATE REQUEST ==================
export const createRequest = async (req, res) => {
  try {
    // -------- HANDLE ATTACHMENTS --------
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

    // -------- DESTRUCTURE REQUEST BODY --------
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

    // -------- GENERATE SERIAL NUMBER --------
    const lastRequest = await Request.findOne().sort({ createdAt: -1 });
    let lastNumber = 0;
    if (lastRequest?.serialNumber) {
      const parts = lastRequest.serialNumber.split("-");
      lastNumber = parseInt(parts[2]) || 0;
    }
    const year = new Date().getFullYear();
    const serialNumber = `REQ-${year}-${String(lastNumber + 1).padStart(4, "0")}`;

    // -------- PARSE APPROVALS --------
    let approvalsData = [];
    if (approvals) {
      let parsedApprovals = typeof approvals === "string" ? JSON.parse(approvals || "[]") : approvals;
      if (Array.isArray(parsedApprovals)) {
        approvalsData = parsedApprovals.map((a, index) => ({
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
    }

    // -------- PARSE ITEMS --------
    let itemsData = [];
    if (items) {
      let parsedItems = typeof items === "string" ? JSON.parse(items || "[]") : items;
      if (Array.isArray(parsedItems)) {
        itemsData = parsedItems.map(item => ({
          itemName: item.itemName || item.description || "-",
          quantity: Number(item.quantity) || Number(item.qty) || 0,
          estimatedCost: Number(item.estimatedCost) || 0,
          supplier: item.supplier || "",
          reason: item.reason || item.remarks || "-",
          startDate: item.startDate ? new Date(item.startDate) : null,
          endDate: item.endDate ? new Date(item.endDate) : null,
        }));
      }
    }

    // -------- CREATE REQUEST --------
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

    // -------- PARSE DETAILS sebelum PDF --------
    let parsedDetails = populatedRequest.details;
    if (typeof parsedDetails === "string") {
      try { parsedDetails = JSON.parse(parsedDetails); } catch { parsedDetails = {}; }
    }

    // -------- GENERATE PDF BUFFER ✅ GUNA PDF UTILITY SAMA UNTUK SEMUA EMAIL & DOWNLOAD
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePDFWithLogo({ ...populatedRequest.toObject(), details: parsedDetails });
      if (!Buffer.isBuffer(pdfBuffer)) pdfBuffer = null;
    } catch (pdfErr) {
      console.error("❌ PDF generate error:", pdfErr.message);
    }

    // -------- SEND EMAIL TO APPROVERS --------
    for (const approval of populatedRequest.approvals) {
      if (!approval.approverId?.email) continue;

      const subject = `Permohonan Baru Dari ${staffName}`;
      const dashboardUrl = process.env.DASHBOARD_URL || "https://uwleapprovalsystem.onrender.com";

      const html = `
        <div style="font-family: Arial; line-height:1.5; color:#333;">
          <h2 style="color:#1a73e8;">Permohonan Baru Untuk Semakan</h2>
          <p>Hi <strong>${approval.approverId.username || approval.approverName}</strong>,</p>
          <p>Anda mempunyai permohonan baru yang perlu disemak.</p>
          <p><strong>Jenis Permohonan:</strong> ${requestType}</p>
          <p><strong>Butiran:</strong> ${parsedDetails.issue || "-"}</p>
          <p><a href="${dashboardUrl}" style="background:#1a73e8;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">Log Masuk Dashboard</a></p>
        </div>
      `;

      try {
        await sendEmail({
          to: approval.approverId.email,
          subject,
          html,
          attachments: pdfBuffer ? [{ filename: `Permohonan_${newRequest._id}.pdf`, content: pdfBuffer }] : [],
        });
      } catch (emailErr) {
        console.error("❌ Email error:", emailErr.message);
      }
    }

    res.status(201).json(populatedRequest);

  } catch (err) {
    console.error("❌ createRequest error:", err);
    res.status(500).json({ message: "Gagal simpan request", error: err.message });
  }
};

// ================== ASSIGN TECHNICIAN ==================
export const assignTechnician = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { technicianId } = req.body;

    if (!technicianId) return res.status(400).json({ message: "TechnicianId diperlukan" });
    if (user.role.toLowerCase() !== "approver") return res.status(403).json({ message: "Hanya Approver boleh assign." });

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request tidak dijumpai" });

    const technician = await User.findById(technicianId);
    if (!technician) return res.status(404).json({ message: "Technician tidak dijumpai" });
    if (technician.role.toLowerCase() !== "technician") return res.status(400).json({ message: "User bukan technician" });

    // ---------- Update Request ----------
    request.assignedTechnician = technicianId;
    request.maintenanceStatus = "Submitted";
    request.assignedAt = new Date();
    const priorityField = request.priority || request.priorityLevel || "Normal";
    request.slaHours = priorityField.toLowerCase() === "urgent" ? 4 : 24;
    await request.save();

    // ---------- PARSE DETAILS sebelum PDF ----------
    let parsedDetails = request.details;
    if (typeof parsedDetails === "string") {
      try { parsedDetails = JSON.parse(parsedDetails); } catch { parsedDetails = {}; }
    }

    // ---------- GENERATE PDF BUFFER =========
    const pdfBuffer = await generatePDFWithLogo({ ...request.toObject(), details: parsedDetails });

    // ---------- EMAIL TO TECHNICIAN ----------
    if (technician.email && technician.email.includes("@")) {
      const dashboardUrl = process.env.DASHBOARD_URL || "https://uwleapprovalsystem.onrender.com";

      const issue = request.problemDescription || parsedDetails.issue || "Not Provided";
      const location = parsedDetails.location || "Not Provided";
      const priority = parsedDetails.priority || request.priority || "Normal";
      const sla = request.slaHours || 24;
      const assignedAt = request.assignedAt ? new Date(request.assignedAt).toLocaleString() : "Not Assigned";

      const html = `
<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
  <h2 style="color:#1a73e8;">New Maintenance Task Assigned</h2>
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
  <p style="font-size:12px;color:gray;">This is an automated message from E-Approval System.</p>
</div>
      `;

      try {
        await sendEmail({
          to: technician.email,
          subject: `New Maintenance Task Assigned - ${issue}`,
          html,
          attachments: pdfBuffer ? [{ filename: `Request_${request._id}.pdf`, content: pdfBuffer }] : [],
        });
        console.log(`✅ Email sent to technician: ${technician.email}`);
      } catch (emailErr) {
        console.error("❌ Technician email error:", emailErr.message);
      }
    }

    res.status(200).json({ message: "Technician assigned successfully.", request });

  } catch (err) {
    console.error("❌ assignTechnician error:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ================== DOWNLOAD PDF ==================
export const downloadPDF = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).populate("approvals userId");
    if (!request) return res.status(404).json({ message: "Request not found" });

    let parsedDetails = request.details;
    if (typeof parsedDetails === "string") {
      try { parsedDetails = JSON.parse(parsedDetails); } catch { parsedDetails = {}; }
    }

    const pdfBuffer = await generatePDFWithLogo({ ...request.toObject(), details: parsedDetails });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Request_${request._id}.pdf`,
    });
    res.send(pdfBuffer);

  } catch (err) {
    console.error("❌ downloadPDF error:", err.message);
    res.status(500).json({ message: "Gagal download PDF", error: err.message });
  }
};
