// controllers/requestController.js
import Request from "../models/Requests.js";
import User from "../models/user.js";
import { sendEmail } from "../utils/emailService.js";
import { uploadFileToSupabase } from "../utils/supabaseUpload.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js";
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
    if (lastRequest && lastRequest.serialNumber) {
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

    // -------- GENERATE PDF --------
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePDFWithLogo(newRequest._id);
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
          <p><strong>Butiran:</strong> ${details || "-"}</p>
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

// ================== GET ALL REQUESTS ==================
export const getRequests = async (req, res) => {
  try {
    const requests = await Request.find()
      .populate("userId", "username department email")
      .populate("approvals.approverId", "username department email")
      .sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    console.error("❌ getRequests error:", err.message);
    res.status(500).json({ message: "Gagal ambil senarai request", error: err.message });
  }
};

// ================== GET REQUESTS FOR TECHNICIAN ==================
export const getRequestsForTechnician = async (req, res) => {
  try {
    const technicianId = req.user._id;
    const requests = await Request.find({
      assignedTechnician: technicianId,
      maintenanceStatus: { $in: ["Submitted", "In Progress"] },
    })
      .populate("userId", "username department email")
      .populate("approvals.approverId", "username department email")
      .sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    console.error("❌ getRequestsForTechnician error:", err);
    res.status(500).json({ message: "Gagal ambil request technician", error: err.message });
  }
};

// ================== APPROVE LEVEL ==================
export const approveLevel = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).populate("userId");
    if (!request) return res.status(404).json({ message: "Request not found" });

    const levelToApprove = request.approvals.find(a => a.approverId?.toString() === req.user._id.toString());
    if (!levelToApprove) return res.status(403).json({ message: "Not authorized to approve" });

    levelToApprove.status = "Approved";
    levelToApprove.actionDate = new Date();
    if (req.body.signatureApprover) levelToApprove.signature = req.body.signatureApprover;

    if (request.requestType === "Maintenance" && req.body.assignedTechnician) {
      request.assignedTechnician = req.body.assignedTechnician;
      if (request.maintenanceStatus === "Submitted") request.maintenanceStatus = "In Progress";
    }

    const allApproved = request.approvals.every(a => a.status === "Approved");
    if (allApproved) request.finalStatus = "Approved";

    if (allApproved) {
      try {
        const pdfBuffer = await generatePDFWithLogo(request._id);
        const staffEmail = request.userId?.email;
        if (staffEmail) {
          await sendEmail({
            to: staffEmail,
            subject: "Permohonan Anda Telah Diluluskan",
            html: `<p>Assalamualaikum ${request.staffName},</p><p>Permohonan anda telah <b>DILULUSKAN</b>.</p><p>Sila rujuk PDF yang dilampirkan.</p><br/><p>Terima kasih.</p>`,
            attachments: [{ filename: `Permohonan_${request._id}.pdf`, content: pdfBuffer }],
          });
        }
      } catch (pdfErr) { console.error("❌ Error generate/send final PDF/email:", pdfErr.message); }
    }

    await request.save();
    res.status(200).json({ message: "Level approved successfully", request });

  } catch (err) {
    console.error("❌ approveLevel error:", err.message);
    res.status(500).json({ message: "Gagal approve level", error: err.message });
  }
};

// ================== REJECT LEVEL ==================
export const rejectLevel = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const levelToReject = request.approvals.find(a => a.approverId?.toString() === req.user._id.toString());
    if (!levelToReject) return res.status(403).json({ message: "Not authorized to reject" });

    levelToReject.status = "Rejected";
    levelToReject.actionDate = new Date();
    if (req.body.signatureApprover) levelToReject.signature = req.body.signatureApprover;

    request.finalStatus = "Rejected";
    await request.save();
    res.status(200).json({ message: "Level rejected", request });
  } catch (err) {
    console.error("❌ rejectLevel error:", err);
    res.status(500).json({ message: "Gagal reject level", error: err.message });
  }
};

// ================== ASSIGN TECHNICIAN ==================
export const assignTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { technicianId } = req.body;
    if (!technicianId) return res.status(400).json({ message: "TechnicianId diperlukan" });

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request tidak dijumpai" });

    const technician = await User.findById(technicianId);
    if (!technician) return res.status(404).json({ message: "Technician tidak dijumpai" });

    request.assignedTechnician = technicianId;
    request.maintenanceStatus = "Submitted";
    request.assignedAt = new Date();

    const priority = request.priority || "Normal";
    request.slaHours = priority.toLowerCase() === "urgent" ? 4 : 24;

    await request.save();

    const pdfBuffer = await generatePDFWithLogo(request._id);

    if (technician.email) {
      await sendEmail({
        to: technician.email,
        subject: "Maintenance Task Assigned",
        html: `<h3>Hi ${technician.username}, anda telah ditugaskan maintenance request.</h3>`,
        attachments: pdfBuffer ? [{ filename: `Request_${request._id}.pdf`, content: pdfBuffer }] : [],
      });
    }

    res.status(200).json({ message: "Technician assigned successfully", request });
  } catch (err) {
    console.error("❌ assignTechnician error:", err);
    res.status(500).json({ message: "Assign technician failed", error: err.message });
  }
};

// ================== TECHNICIAN UPDATE STATUS ==================
export const technicianUpdateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["In Progress", "Completed"].includes(status))
      return res.status(400).json({ message: "Status tidak sah" });

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request tidak dijumpai" });

    if (!request.assignedTechnician || request.assignedTechnician.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Bukan technician assigned" });

    if (status === "In Progress") {
      request.maintenanceStatus = "In Progress";
      if (!request.startedAt) request.startedAt = new Date();
    }

    if (status === "Completed") {
      request.maintenanceStatus = "Completed";
      request.completedAt = new Date();
      request.finalStatus = "Completed";
      if (request.startedAt) {
        request.timeToComplete = Math.round((request.completedAt - request.startedAt) / 60000);
      }
    }

    await request.save();
    res.status(200).json({ message: `Request updated to ${status}`, request });
  } catch (err) {
    console.error("❌ technicianUpdateStatus error:", err);
    res.status(500).json({ message: "Technician update failed", error: err.message });
  }
};

// ================== DOWNLOAD PDF ==================
export const downloadPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id).populate("approvals userId");
    if (!request) return res.status(404).json({ message: "Request tak jumpa" });
    const pdfBytes = await generatePDFWithLogo(request._id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Request_${id}.pdf`,
    });
    res.send(pdfBytes);
  } catch (err) {
    console.error("❌ downloadPDF error:", err);
    res.status(500).json({ message: "Gagal download PDF", error: err.message });
  }
};
