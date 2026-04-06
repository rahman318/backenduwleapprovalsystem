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

    console.log("✅ Files uploaded to Supabase & prepared for Mongo:", attachmentsData);

    // -------- DESTRUCTURE REQUEST BODY --------
    const {
      userId,
      staffName,
      staffDepartment,
      requestType,
      details,
      problemDescription, // ✅ baru
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
      requestorEmail: req.body.requestorEmail || req.user?.email || "-", // ✅ assign email
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

    // -------- GENERATE PDF BUFFER --------
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePDFWithLogo(populatedRequest);
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

    // ================= SEND EMAIL CONFIRMATION TO REQUESTOR =================
    try {
      const requestorEmail = populatedRequest.userId?.email;

      if (requestorEmail && requestorEmail.includes("@")) {
        const dashboardUrl = process.env.DASHBOARD_URL || "https://uwleapprovalsystem.onrender.com";

        const html = `
          <div style="font-family: Arial; line-height:1.6; color:#333;">
            <h2 style="color:#28a745;">Permohonan Berjaya Dihantar ✅</h2>

            <p>Assalamualaikum <strong>${staffName}</strong>,</p>

            <p>Permohonan anda telah berjaya dihantar ke sistem e-Approval.</p>

            <hr/>

            <table style="margin:10px 0;">
              <tr>
                <td><b>No. Rujukan</b></td>
                <td>: ${serialNumber}</td>
              </tr>
              <tr>
                <td><b>Jenis Permohonan</b></td>
                <td>: ${requestType}</td>
              </tr>
              <tr>
                <td><b>Status</b></td>
                <td>: Pending Approval</td>
              </tr>
            </table>

            <br/>

            <p>Sila simpan nombor rujukan ini untuk semakan akan datang.</p>

            <p>
              <a href="${dashboardUrl}" 
                 style="background:#28a745;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">
                 Lihat Permohonan
              </a>
            </p>

            <br/>
            <p>Terima kasih.</p>
          </div>
        `;

        await sendEmail({
          to: requestorEmail,
          subject: `Permohonan Berjaya Dihantar (${serialNumber})`,
          html,
          attachments: pdfBuffer
            ? [{ filename: `Permohonan_${newRequest._id}.pdf`, content: pdfBuffer }]
            : [],
        });

        console.log(`✅ Email confirmation sent to requestor: ${requestorEmail}`);
      } else {
        console.warn("⚠️ Requestor email tak valid / tiada");
      }

    } catch (emailErr) {
      console.error("❌ Error send email to requestor:", emailErr.message);
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

//=================== GET STAFF REQUEST HISTORY====================
export const getMyRequests = async (req, res) => {
  try {
    const requests = await Request.find({ userId: req.user.id })
      .populate("approvals.approverId", "name email department") // populate siap info approver
      .sort({ createdAt: -1 }); // latest first

    res.json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ message: "Failed to fetch requests" });
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
        const pdfBuffer = await generatePDFWithLogo(request);
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
    const request = await Request.findById(req.params.id).populate("userId");
    if (!request) return res.status(404).json({ message: "Request not found" });

    const levelToReject = request.approvals.find(
      a => a.approverId?.toString() === req.user._id.toString()
    );
    if (!levelToReject)
      return res.status(403).json({ message: "Not authorized to reject" });

    // 🔥 UPDATE STATUS
    levelToReject.status = "Rejected";
    levelToReject.actionDate = new Date();

    // 🔥 SIMPAN SIGNATURE JIKA ADA
    if (req.body.signatureApprover) {
      levelToReject.signature = req.body.signatureApprover;
    }

    // 🔥 TAMBAH REMARK PER LEVEL
    if (req.body.remark) {
      levelToReject.remark = req.body.remark;
    }

    // 🔥 OPTIONAL: SIMPAN GLOBAL REMARK UNTUK PDF
    request.remark = req.body.remark || "";

    // 🔥 FINAL STATUS REJECT
    request.finalStatus = "Rejected";

    await request.save();

    // 🔥 KIRIM EMAIL KE STAFF/REQUESTOR
    try {
      const pdfBuffer = await generatePDFWithLogo(request);
      const staffEmail = request.userId?.email;
      if (staffEmail && staffEmail.includes("@")) {
        await sendEmail({
          to: staffEmail,
          subject: "Permohonan Anda Telah Ditolak",
          html: `
            <div style="font-family: Arial; line-height:1.5; color:#333;">
              <h2 style="color:#e53935;">Permohonan Ditolak</h2>
              <p>Assalamualaikum <strong>${request.staffName}</strong>,</p>
              <p>Permohonan anda telah <b>DITOLAK</b>.</p>
              <p><strong>Sebab:</strong> ${levelToReject.remark || "-"}</p>
              <p>Sila rujuk PDF yang dilampirkan untuk maklumat lanjut.</p>
              <p>Terima kasih.</p>
            </div>
          `,
          attachments: pdfBuffer ? [{ filename: `Permohonan_${request._id}.pdf`, content: pdfBuffer }] : [],
        });
      }
    } catch (emailErr) {
      console.error("❌ Error generate/send rejected PDF/email:", emailErr.message);
    }

    res.status(200).json({ message: "Level rejected & email sent to staff", request });

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

    const technician = await User.findById(technicianId);
    if (!technician)
      return res.status(404).json({ message: "Technician tidak dijumpai" });
    if (technician.role.toLowerCase() !== "technician")
      return res.status(400).json({ message: "User bukan technician" });

    // ---------- Update Request ----------
    request.assignedTechnician = technicianId;
    request.maintenanceStatus = "Submitted";
    request.assignedAt = new Date();
    const priorityField = request.priority || request.priorityLevel || "Normal";
    request.slaHours = priorityField.toLowerCase() === "urgent" ? 4 : 24;
    await request.save();

    // ---------- EMAIL NOTIFICATION ----------
console.log("📧 Preparing to send email notification to technician...");

// Ambil Issue / Location / Priority dari details jika ada, fallback ke default
const issue = request.problemDescription || request.details?.issue || "Not Provided";
const location = request.details?.location || "Not Provided";
const priority = request.details?.priority || "Normal";
const sla = request.slaHours || 24;
const assignedAt = request.assignedAt ? new Date(request.assignedAt).toLocaleString() : "Not Assigned";

if (technician.email && technician.email.includes("@")) {
  try {
    const dashboardUrl = process.env.DASHBOARD_URL || "https://uwleapprovalsystem.onrender.com";
    const pdfBuffer = await generatePDFWithLogo(request);

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
      attachments: pdfBuffer ? [{ filename: `Request_${request._id}.pdf`, content: pdfBuffer }] : [],
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
};

// ================== TECHNICIAN UPDATE STATUS ==================
export const technicianUpdateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["In Progress", "Completed"].includes(status)) 
      return res.status(400).json({ message: "Status tidak sah" });

    // ====== GET REQUEST ======
    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request tidak dijumpai" });

    // ====== CHECK TECHNICIAN ======
    if (!request.assignedTechnician || request.assignedTechnician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Akses ditolak: bukan technician assigned" });
    }

    // ====== UPDATE STATUS ======
    if (status === "In Progress") {
      request.maintenanceStatus = "In Progress";
      if (!request.assignedAt) request.assignedAt = new Date();
      request.startedAt = new Date();
    } else if (status === "Completed") {
      request.maintenanceStatus = "Completed";
      request.completedAt = new Date();
      request.finalStatus = "Completed";

      if (request.startedAt) {
        const durationMs = request.completedAt - request.startedAt;
        request.timeToComplete = Math.round(durationMs / 60000);
      }
    }

    await request.save();

    // ====== POPULATE APPROVERS SEBELUM EMAIL ======
    const requestWithApprovers = await Request.findById(id).populate("approvals.approverId");

    // ====== SEND EMAIL TO APPROVERS ======
    for (const approval of requestWithApprovers.approvals) {
      if (!approval.approverId?.email) continue;

      const subject = `Status Permohonan Telah Dikemaskini oleh Technician`;
      const dashboardUrl = process.env.DASHBOARD_URL || "https://uwleapprovalsystem.onrender.com";

      const html = `
        <div style="font-family: Arial, sans-serif; line-height:1.5; color:#333;">
          <h3 style="color:#1a73e8;">Status Request Dikemaskini</h3>
          <p>Hi <strong>${approval.approverId.username || approval.approverName}</strong>,</p>
          <p>Technician telah kemaskini status request "<strong>${requestWithApprovers.requestType}</strong>" kepada <strong>${requestWithApprovers.maintenanceStatus}</strong>.</p>
          <p>No. Rujukan: <strong>${requestWithApprovers.serialNumber}</strong></p>
          <p>Staff: ${requestWithApprovers.staffName}</p>
          <p>Sila semak dashboard untuk maklumat lanjut:</p>
          <p>
            <a href="${dashboardUrl}/approver/requests/${requestWithApprovers._id}" 
               style="background:#1a73e8;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">
               Log Masuk Dashboard
            </a>
          </p>
        </div>
      `;

      try {
        await sendEmail({
          to: approval.approverId.email,
          subject,
          html,
        });
        console.log(`✅ Email notification sent to approver: ${approval.approverId.email}`);
      } catch (emailErr) {
        console.error(`❌ Failed to send email to ${approval.approverId.email}:`, emailErr.message);
      }
    }

    res.status(200).json({ message: `Request updated to ${status} & approvers notified`, request });

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
    const pdfBytes = await generatePDFWithLogo(request);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=Request_${id}.pdf` });
    res.send(pdfBytes);
  } catch (err) {
    console.error("❌ Download PDF error:", err.message);
    res.status(500).json({ message: "Gagal download PDF", error: err.message });
  }
};
