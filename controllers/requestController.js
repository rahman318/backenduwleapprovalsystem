// controllers/requestController.js
import Request from "../models/Requests.js";
import User from "../models/user.js";
import { sendEmail } from "../utils/emailService.js";
import { uploadFileToSupabase } from "../utils/supabaseUpload.js";
import { generateGenericPDF } from "../utils/generateGenericPDF.js";
import generatePDF from "../utils/generatePDF.js";
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
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const publicUrl = await uploadFileToSupabase(file);
        attachmentsData.push({
          originalName: file.originalname,
          fileName: file.originalname,
          url: publicUrl,
          mimetype: file.mimetype,
          size: file.size,
        });
      }
      console.log("✅ Files uploaded to Supabase & prepared for Mongo:", attachmentsData);
    }

    // -------- DESTRUCTURE REQUEST BODY --------
    const {
      userId,
      staffName,
      staffDepartment,
      requestType,
      details,
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

    // -------- GENERATE PDF BUFFER --------
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateGenericPDF(populatedRequest);
      if (!Buffer.isBuffer(pdfBuffer)) pdfBuffer = null;
    } catch (pdfErr) { console.error("❌ PDF generate error:", pdfErr.message); }

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
      } catch (emailErr) { console.error("❌ Email error:", emailErr.message); }
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
    console.error("❌ getTechnicianRequests error:", err.message);
    res.status(500).json({ message: "Gagal ambil request untuk technician", error: err.message });
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
        const pdfBuffer = await generateGenericPDF(request);
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

// ================== SEND EMAIL TO STAFF ==================
    if (allApproved && request.staffEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
          <h2 style="color: #1a73e8;">Permohonan Anda Telah Diluluskan</h2>
          <p>Hi <strong>${request.staffName}</strong>,</p>
          <p>Permohonan anda telah diluluskan oleh semua approver.</p>
          <p>Butiran permohonan:</p>
          <table style="width:100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding:6px 8px; font-weight:bold; background:#f0f0f0;">Jenis Permohonan</td><td style="padding:6px 8px;">${request.requestType}</td></tr>
            <tr><td style="padding:6px 8px; font-weight:bold; background:#f0f0f0;">Butiran</td><td style="padding:6px 8px;">${request.details || "-"}</td></tr>
          </table>
          <p>Sila semak attachment PDF untuk dokumen rasmi.</p>
        </div>
      `;

      try {
        await sendEmail({
          to: request.staffEmail,
          subject: `Permohonan Anda Telah Diluluskan: ${request.requestType}`,
          html,
          attachments: pdfBuffer ? [{ filename: `Permohonan_${request._id}.pdf`, content: pdfBuffer }] : []
        });
      } catch (emailErr) {
        console.error("❌ Gagal hantar email ke staff:", emailErr.message);
      }
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
    console.error("❌ rejectLevel error:", err.message);
    res.status(500).json({ message: "Gagal reject level", error: err.message });
  }
};

// ================== ASSIGN TECHNICIAN ==================
export const assignTechnician = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { technicianId } = req.body;

    if (!technicianId)
      return res.status(400).json({ message: "TechnicianId diperlukan" });

    if (user.role.toLowerCase() !== "approver")
      return res.status(403).json({ message: "Hanya Approver boleh assign." });

    const request = await Request.findById(id);
    if (!request)
      return res.status(404).json({ message: "Request tidak dijumpai" });

    // ✅ Ambil full technician object dari User collection
    const technician = await User.findById(technicianId);
    if (!technician)
      return res.status(404).json({ message: "Technician tidak dijumpai" });

    if (technician.role.toLowerCase() !== "technician")
      return res.status(400).json({ message: "User bukan technician" });

    // ✅ Update Request
    request.assignedTechnician = technicianId;
    request.maintenanceStatus = "Submitted";
    request.slaHours = request.priority === "Urgent" ? 4 : 24;

    await request.save();

    // ================== EMAIL NOTIFICATION ==================
    console.log("📧 Preparing to send email notification...");
    console.log("Technician object:", technician);
    console.log("Technician email:", JSON.stringify(technician.email));

    if (!technician.email || !technician.email.includes("@")) {
      console.warn(`⚠️ Technician ${technician.name} tidak ada email valid`);
    } else {
      try {
        console.log(`📨 Attempting to send email to: ${technician.email}`);

        await sendEmail({
          to: technician.email,
          subject: "New Maintenance Task Assigned - E-Approval System",
          html: `
            <div style="font-family: Arial; padding: 15px;">
              <h2>Hello ${technician.name},</h2>
              <p>You have been assigned a new maintenance request.</p>
              <hr/>
              <p><strong>Issue:</strong> ${request.issue}</p>
              <p><strong>Location:</strong> ${request.location}</p>
              <p><strong>Priority:</strong> ${request.priority}</p>
              <p><strong>SLA:</strong> ${request.slaHours} hours</p>
              <br/>
              <p>Please login to the system to start the task.</p>
              <br/>
              <p style="font-size:12px;color:gray;">This is an automated message from E-Approval System.</p>
            </div>
          `
        });

        console.log(`✅ SUCCESS: Email sent to ${technician.email}`);
      } catch (emailError) {
        console.error("❌ FAILED: Email sending error");
        console.error(emailError.response?.data || emailError.message);
      }
    }

    res.status(200).json({
      message: "Technician assigned successfully.",
      request,
    });
  } catch (err) {
    console.error("❌ Error assign technician:", err);
    res.status(500).json({ message: "Server error", error: err.message });
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

    if (!request.assignedTechnician || request.assignedTechnician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Akses ditolak: bukan technician assigned" });
    }

    if (status === "In Progress") {
      request.maintenanceStatus = "In Progress";
      request.startedAt = new Date();
    } else if (status === "Completed") {
      request.maintenanceStatus = "Completed";
      request.completedAt = new Date();
      request.finalStatus = "Completed";

      // ===== Kira time to complete =====
      if (request.startedAt) {
        const durationMs = request.completedAt - request.startedAt;
        request.timeToComplete = Math.round(durationMs / 60000); // minit
      }
    }

    await request.save();
    res.status(200).json({ message: `Request updated to ${status}`, request });
  } catch (err) {
    console.error("❌ Technician update error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ================== GET PDF ==================
export const downloadGenericPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id).populate("approvals userId");
    if (!request) return res.status(404).json({ message: "Request tak jumpa" });
    const pdfBytes = await generateGenericPDF(request);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=Request_${id}.pdf` });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("❌ Generic PDF error:", err);
    res.status(500).json({ message: "Gagal jana PDF" });
  }
};

export const downloadPurchasePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id).populate("approvals userId");
    if (!request) return res.status(404).json({ message: "Request tak jumpa" });
    const pdfBytes = await generatePDF(request);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=Purchase_${id}.pdf` });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("❌ Purchase PDF error:", err);
    res.status(500).json({ message: "Gagal jana PDF" });
  }

};

